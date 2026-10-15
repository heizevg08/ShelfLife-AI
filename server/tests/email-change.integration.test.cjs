const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { userModel } = require('../dist/models/user');
const { auditRecordModel } = require('../dist/models/audit-record');
const { hashPassword } = require('../dist/services/password');
const { createEmailChange } = require('../dist/services/email-change');
const { createEmailChangeStore } = require('../dist/services/email-change-store');

test('isolated Mongo email activation atomically consumes OTP, revokes sessions and records audit', async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const driver = new Mongoose();
  await driver.connect(replica.getUri('shelflifeai_email_change_test'), { autoIndex: false });
  t.after(async () => { await driver.disconnect(); await replica.stop(); });

  const Users = userModel(driver), Audits = auditRecordModel(driver);
  await Promise.all([Users.init(), Audits.init()]);
  const account = await Users.create({ firstName: 'Test', lastName: 'Admin', email: 'old@shelflife.com',
    passwordHash: await hashPassword('current-password-123'), role: 'Admin', isActive: true, authVersion: 4 });
  let delivered;
  const store = createEmailChangeStore(driver, Users, Audits);
  const service = createEmailChange(store, { send: async (email, code) => { delivered = { email, code }; } });

  await service.request(account.id, { email: 'new@shelflife.com', currentPassword: 'current-password-123' });
  await service.complete(account.id, { code: delivered.code });
  const activated = await Users.findById(account.id).lean();
  assert.equal(activated.email, delivered.email);
  assert.equal(activated.authVersion, 5);
  assert.equal(activated.emailChangeCodeHash, undefined);
  assert.equal(await Audits.countDocuments({ userId: account.id, module: 'Account Profile', targetName: 'Own account' }), 1);

  const second = await Users.create({ firstName: 'Audit', lastName: 'Failure', email: 'audit-old@shelflife.com',
    passwordHash: await hashPassword('current-password-123'), role: 'Admin', isActive: true, authVersion: 2 });
  const failingAudits = { create: async () => { throw new Error('simulated audit storage failure'); } };
  const rollbackStore = createEmailChangeStore(driver, Users, failingAudits);
  let secondCode;
  const rollbackService = createEmailChange(rollbackStore, { send: async (_email, code) => { secondCode = code; } });
  await rollbackService.request(second.id, { email: 'audit-new@shelflife.com', currentPassword: 'current-password-123' });
  await assert.rejects(rollbackService.complete(second.id, { code: secondCode }));
  const rolledBack = await Users.findById(second.id).select('+pendingEmail').lean();
  assert.equal(rolledBack.email, 'audit-old@shelflife.com');
  assert.equal(rolledBack.authVersion, 2);
  assert.equal(rolledBack.pendingEmail, 'audit-new@shelflife.com');
});

test('isolated Mongo activation enforces the attempt limit in the final guarded write', async t => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const driver = new Mongoose();
  await driver.connect(replica.getUri('shelflifeai_email_attempt_test'), { autoIndex: false });
  t.after(async () => { await driver.disconnect(); await replica.stop(); });
  const Users = userModel(driver), Audits = auditRecordModel(driver);
  await Promise.all([Users.init(), Audits.init()]);
  const account = await Users.create({ firstName: 'Test', lastName: 'Admin', email: 'staff-old@shelflife.com',
    passwordHash: await hashPassword('current-password-123'), role: 'Admin', isActive: true, authVersion: 1 });
  let code;
  const service = createEmailChange(createEmailChangeStore(driver, Users, Audits), { send: async (_email, value) => { code = value; } });
  await service.request(account.id, { email: 'staff-new@shelflife.com', currentPassword: 'current-password-123' });
  await Users.updateOne({ _id: account.id }, { $set: { emailChangeAttempts: 5 } });
  await assert.rejects(service.complete(account.id, { code }));
  const unchanged = await Users.findById(account.id).lean();
  assert.equal(unchanged.email, 'staff-old@shelflife.com');
  assert.equal(unchanged.authVersion, 1);
  assert.equal(await Audits.countDocuments({ userId: account.id }), 0);
});
