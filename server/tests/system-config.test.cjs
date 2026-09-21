const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes, randomUUID } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createSystemConfig, systemConfigInput } = require('../dist/services/system-config');
const { systemConfigModel, SYSTEM_CONFIG_ID, SYSTEM_DEFAULTS } = require('../dist/models/system-config');
const { auditRecordModel } = require('../dist/models/audit-record');

test('system config input rejects unsafe values, precision loss and missing concurrency version', () => {
  assert.equal(systemConfigInput({ expectedVersion: 0, lowStockMultiplier: '1.2' }).patch.lowStockMultiplier, '1.200');
  for (const body of [{ approachingDays: 7 }, { expectedVersion: 0 }, { expectedVersion: 0, criticalDays: 1.5 }, { expectedVersion: 0, lowStockMultiplier: 1 }, { expectedVersion: 0, lowStockMultiplier: '1.0001' }, { expectedVersion: 0, _id: SYSTEM_CONFIG_ID }]) assert.throws(() => systemConfigInput(body));
});

test('system config HTTP reads permit all roles, writes only Super Admin, before input parsing', async () => {
  const roles = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
  const users = roles.map((role, i) => ({ _id: String(i + 1).repeat(24), email: `config${i}@shelflife.com`, role, isActive: true }));
  const auth = createAuth({ byId: async id => users.find(user => user._id === id), byEmail: async () => null }, randomBytes(48).toString('hex'));
  let calls = 0;
  const config = { get: async () => ({ ...SYSTEM_DEFAULTS }), patch: async (_actor, body) => { calls++; const input = systemConfigInput(body); return { ...SYSTEM_DEFAULTS, ...input.patch, version: 1 }; } };
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, config));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/system-config`;
  try {
    assert.equal((await fetch(url)).status, 401);
    for (const user of users) {
      const headers = { Authorization: `Bearer ${auth.issue(user).accessToken}`, 'Content-Type': 'application/json' };
      const response = await fetch(url, { headers });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), SYSTEM_DEFAULTS);
      const write = await fetch(url, { method: 'PATCH', headers, body: user.role === 'Super Admin' ? JSON.stringify({ expectedVersion: 0, approachingDays: 8 }) : '{broken' });
      assert.equal(write.status, user.role === 'Super Admin' ? 200 : 403);
    }
    assert.equal(calls, 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('MongoDB singleton defaults do not persist; saves version and audit atomically, including first-save races', { skip: process.env.RUN_MONGO_HARDENING_TESTS !== 'true' }, async () => {
  const driver = new Mongoose(), prefix = `config_test_${randomUUID().replaceAll('-', '')}_`, models = [];
  const isolated = factory => { const base = factory(driver); const model = driver.model(`Test${base.modelName}`, base.schema.clone(), prefix + base.collection.name); models.push(model); return model; };
  try {
    await driver.connect(process.env.MONGO_URI, { dbName: 'shelflifeai', autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    const configs = isolated(systemConfigModel), audits = isolated(auditRecordModel);
    for (const model of models) await model.createCollection();
    const service = createSystemConfig(driver, configs, audits), actor = '1'.repeat(24);
    assert.deepEqual(await service.get(), SYSTEM_DEFAULTS);
    assert.equal(await configs.countDocuments(), 0);
    const failing = createSystemConfig(driver, configs, { create: async () => { throw new Error('audit failure'); } });
    await assert.rejects(failing.patch(actor, { expectedVersion: 0, criticalDays: 1 }), /audit failure/);
    assert.equal(await configs.countDocuments(), 0);
    const race = await Promise.allSettled([service.patch(actor, { expectedVersion: 0, approachingDays: 8 }), service.patch(actor, { expectedVersion: 0, approachingDays: 9 })]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(race.find(r => r.status === 'rejected').reason.status, 409);
    assert.equal(await configs.countDocuments(), 1);
    assert.equal(await audits.countDocuments(), 1);
    await assert.rejects(service.patch(actor, { expectedVersion: 1, criticalDays: 20 }), e => e.status === 400);
    await assert.rejects(failing.patch(actor, { expectedVersion: 1, lowStockMultiplier: '2.5' }), /audit failure/);
    assert.equal((await service.get()).version, 1);
    const after = await service.patch(actor, { expectedVersion: 1, lowStockMultiplier: '2.5' });
    assert.equal(after.version, 2); assert.equal(after.lowStockMultiplier, '2.500');
    const raw = await configs.collection.findOne({ _id: new driver.Types.ObjectId(SYSTEM_CONFIG_ID) });
    assert.equal(raw.lowStockMultiplier._bsontype, 'Decimal128');
    const event = await audits.findOne({ action: 'UPDATE' }).lean();
    assert.equal(event.oldValue.version, 1); assert.equal(event.newValue.version, 2); assert.equal(event.newValue.lowStockMultiplier, '2.500');
    await assert.rejects(configs.create({ ...after, _id: new driver.Types.ObjectId() }));
  } finally { try { for (const model of models) { assert.ok(model.collection.name.startsWith(prefix)); await model.collection.drop(); } } finally { await driver.disconnect(); } }
});
