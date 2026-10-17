const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { hashPassword } = require('../dist/services/password');

const secret = randomBytes(48).toString('hex');
const credentials = { email: 'manager@shelflife.com', password: 'isolated-test-password' };
const origins = ['http://localhost:8081'];

async function fixture(t) {
  const row = {
    _id: '0123456789abcdef01234567', email: credentials.email, firstName: 'Test', lastName: 'Manager',
    role: 'Manager', isActive: true, passwordHash: await hashPassword(credentials.password),
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const auth = createAuth({
    byEmail: async email => row?.email === email ? row : null,
    byId: async id => row?._id === id ? row : null,
    recordLogin: async () => {},
  }, secret);
  const events = [];
  let auditFailure;
  const extensions = {
    auditAuthenticationEvent: async (action, actor) => {
      if (auditFailure) throw new Error('simulated audit storage failure');
      events.push({ action, actor: { ...actor } });
    },
  };
  const server = createServer(createApp(origins, () => true, auth, extensions));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  return {
    events,
    failAudit() { auditFailure = true; },
    async login(body, headers = {}) {
      return fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    },
    async logout(token, headers = {}) {
      return fetch(base + '/logout', { method: 'POST', headers: { Origin: origins[0], ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
    },
  };
}

test('successful Manager login records one LOGIN audit event carrying identity only', async t => {
  const app = await fixture(t);
  const response = await app.login({ email: credentials.email, password: credentials.password });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(app.events.length, 1);
  assert.equal(app.events[0].action, 'LOGIN');
  assert.equal(app.events[0].actor.id, result.user.id);
  assert.equal(app.events[0].actor.name, 'Test Manager');
  assert.equal(app.events[0].actor.role, 'Manager');
  // The audit boundary must never carry credential or token material.
  const serialized = JSON.stringify(app.events);
  assert.equal(serialized.includes(credentials.password), false);
  assert.equal(serialized.includes(result.accessToken), false);
  assert.equal(serialized.includes(rowHashMarker()), false);
});

function rowHashMarker() { return 'passwordHash'; }

test('failed authentication attempts do not create LOGIN audit events', async t => {
  const app = await fixture(t);
  const rejected = await app.login({ email: credentials.email, password: 'wrong-password' });
  assert.equal(rejected.status, 401);
  const missing = await app.login({ email: 'missing@shelflife.com', password: credentials.password });
  assert.equal(missing.status, 401);
  assert.equal(app.events.length, 0);
});

test('a failed LOGIN audit write fails the login so no token is issued without a trail', async t => {
  const app = await fixture(t);
  app.failAudit();
  const response = await app.login({ email: credentials.email, password: credentials.password });
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.message, 'Internal server error');
  assert.equal(app.events.length, 0);
});

test('logout with a valid bearer records one LOGOUT audit event and returns 204', async t => {
  const app = await fixture(t);
  const login = await app.login({ email: credentials.email, password: credentials.password });
  const { accessToken } = await login.json();
  const response = await app.logout(accessToken);
  assert.equal(response.status, 204);
  assert.equal(app.events.length, 2);
  assert.equal(app.events[1].action, 'LOGOUT');
  assert.equal(app.events[1].actor.id, '0123456789abcdef01234567');
  assert.equal(app.events[1].actor.role, 'Manager');
});

test('logout with an expired or absent bearer still signs out and records nothing', async t => {
  const app = await fixture(t);
  const expired = jwt.sign({ version: 0 }, secret, { algorithm: 'HS256', issuer: 'shelflifeai', audience: 'shelflifeai-client', subject: '0123456789abcdef01234567', expiresIn: -1 });
  assert.equal((await app.logout(expired)).status, 204);
  assert.equal((await app.logout(null)).status, 204);
  assert.equal(app.events.length, 0);
});

test('a failed LOGOUT audit write never fails the sign-out itself', async t => {
  const app = await fixture(t);
  const login = await app.login({ email: credentials.email, password: credentials.password });
  const { accessToken } = await login.json();
  app.events.length = 0;
  app.failAudit();
  const response = await app.logout(accessToken);
  assert.equal(response.status, 204);
});
