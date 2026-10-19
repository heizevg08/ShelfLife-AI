const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { hashPassword } = require('../dist/services/password');
const { normalizeUserRole, userModel } = require('../dist/models/user');
const { auditRecordModel } = require('../dist/models/audit-record');
const { withAuditRecordedNotifications, onAuditRecorded } = require('../dist/services/audit-events');
const { createAdministration } = require('../dist/services/administration');
const { createAdministrationStore } = require('../dist/services/administration-store');

const secret = randomBytes(48).toString('hex');
const origins = ['http://localhost:8081'];

async function replica(t) {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const driver = new Mongoose();
  await driver.connect(server.getUri('shelflifeai_auth_audit_test'), { autoIndex: false });
  t.after(async () => { await driver.disconnect(); await server.stop(); });
  return driver;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('LOGIN audit persistence through the wrapped model fires the notification bus after the write', async t => {
  const driver = await replica(t);
  const Users = userModel(driver), Audits = withAuditRecordedNotifications(auditRecordModel(driver));
  await Promise.all([Users.init(), Audits.init()]);
  const account = await Users.create({ firstName: 'Test', lastName: 'Manager', email: 'bus@shelflife.com',
    passwordHash: await hashPassword('isolated-test-password'), role: 'Manager', isActive: true });
  let notified = 0;
  const unsubscribe = onAuditRecorded(() => { notified += 1; });
  t.after(unsubscribe);

  await Audits.create({ userId: account.id, actorName: 'Test Manager', actorRole: 'Manager', action: 'LOGIN',
    targetType: 'User', targetId: account.id, targetName: 'Own account', module: 'Authentication', status: 'Success' });
  const stored = await Audits.findOne({ action: 'LOGIN', module: 'Authentication' }).lean();
  assert.ok(stored, 'the LOGIN record persisted');
  assert.equal(String(stored.userId), account.id);
  // The notification is deferred so a listener's re-query observes the committed row.
  await delay(250);
  assert.ok(notified >= 1, 'the in-process bus notified after persistence');
});

test('real HTTP flow: Admin SSE stream receives Manager login/logout wake-ups with records persisted and RBAC enforced', async t => {
  const driver = await replica(t);
  const Users = userModel(driver), RawAudits = auditRecordModel(driver);
  await Promise.all([Users.init(), RawAudits.init()]);
  const admin = await Users.create({ firstName: 'Test', lastName: 'Admin', email: 'admin-audit@shelflife.com',
    passwordHash: await hashPassword('isolated-test-password'), role: 'Admin', isActive: true });
  const manager = await Users.create({ firstName: 'Test', lastName: 'Manager', email: 'manager-audit@shelflife.com',
    passwordHash: await hashPassword('isolated-test-password'), role: 'Manager', isActive: true });

  // Mirror the production composition: one wrapped audit model feeds both persistence
  // and the in-process notification bus behind the SSE stream.
  const audits = withAuditRecordedNotifications(RawAudits);
  const userStore = {
    byEmail: async email => Users.findOne({ email }).select('+passwordHash').lean().exec(),
    byId: async id => Users.findById(id).lean().exec(),
    recordLogin: async (id, at) => { await Users.updateOne({ _id: id, isActive: true }, { $set: { lastLoginAt: at } }).exec(); },
  };
  const auth = createAuth(userStore, secret);
  const auditAuthenticationEvent = async (action, actor) => {
    await audits.create({ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined,
      action, targetType: 'User', targetId: actor.id, targetName: 'Own account', module: 'Authentication', status: 'Success' });
  };
  const administration = createAdministration(createAdministrationStore(driver, Users, audits));
  const server = createServer(createApp(origins, () => true, auth, { auditAuthenticationEvent }, administration));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async email => {
    const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'isolated-test-password' }) });
    assert.equal(response.status, 200);
    return (await response.json()).accessToken;
  };

  const adminToken = await login(admin.email);
  const managerToken = await login(manager.email);
  assert.equal(await RawAudits.countDocuments({ action: 'LOGIN', module: 'Authentication' }), 2);

  // Subscribe exactly as the AuditTable client does: fetch streaming with the bearer header.
  const streamAbort = new AbortController();
  const stream = await fetch(`${base}/audit-records/stream`, { headers: { Authorization: `Bearer ${adminToken}` }, signal: streamAbort.signal });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // One continuous pump: overlapping reader.read() calls are not permitted.
  const pump = () => reader.read().then(chunk => {
    if (chunk.value) buffer += decoder.decode(chunk.value, { stream: true });
    if (!chunk.done && !streamAbort.signal.aborted) pump();
  }).catch(() => { /* aborted at teardown */ });
  pump();
  const dataFrames = () => (buffer.match(/^data:/gm) || []).length;
  const waitForDataFrames = async (target, milliseconds) => {
    const deadline = Date.now() + milliseconds;
    while (dataFrames() < target) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${target} data frame(s)`);
      await delay(25);
    }
  };
  const deadline = Date.now() + 3000;
  while (!buffer.includes(': connected')) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the SSE connection frame');
    await delay(25);
  }

  // A fresh Manager sign-in through the real route must wake the connected Admin.
  const framesBeforeLogin = dataFrames();
  const secondManagerLogin = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: manager.email, password: 'isolated-test-password' }) });
  assert.equal(secondManagerLogin.status, 200);
  await waitForDataFrames(framesBeforeLogin + 1, 3000);
  assert.equal(await RawAudits.countDocuments({ action: 'LOGIN', module: 'Authentication', userId: manager.id }), 2);

  // Manager logout flows through the same wake-up path.
  const framesBeforeLogout = dataFrames();
  const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Origin: origins[0], Authorization: `Bearer ${managerToken}` } });
  assert.equal(logout.status, 204);
  await waitForDataFrames(framesBeforeLogout + 1, 3000);
  assert.equal(await RawAudits.countDocuments({ action: 'LOGOUT', module: 'Authentication', userId: manager.id }), 1);

  // The Admin's audit query now returns the Manager authentication records.
  const list = await fetch(`${base}/audit-records?page=1&pageSize=50`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(list.status, 200);
  const page = await list.json();
  const managerAuthRecords = page.items.filter(item => item.module === 'Authentication' && item.actor.id === manager.id);
  assert.equal(managerAuthRecords.length, 3);
  assert.ok(managerAuthRecords.some(item => item.action === 'LOGIN'));
  assert.ok(managerAuthRecords.some(item => item.action === 'LOGOUT'));
  const serialized = JSON.stringify(page);
  assert.equal(serialized.includes('isolated-test-password'), false);
  assert.equal(serialized.includes('passwordHash'), false);

  // Server-side authorization: Manager cannot subscribe to the administrative stream.
  const forbidden = await fetch(`${base}/audit-records/stream`, { headers: { Authorization: `Bearer ${managerToken}` } });
  assert.equal(forbidden.status, 403);
  streamAbort.abort();
});
