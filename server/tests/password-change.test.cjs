const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createPasswordChange } = require('../dist/services/password-change');
const { hashPassword, verifyPassword } = require('../dist/services/password');
const { safeUser } = require('../dist/models/user');
const secret = randomBytes(48).toString('hex');
const userId = '0123456789abcdef01234567';
const currentPassword = 'current-account-password';
const newPassword = 'replacement-account-password';

// An in-memory account that mirrors the real store: the hash is select-only and the write
// bumps the authorization version exactly as the atomic update in server.ts does.
function accountStore(overrides = {}) {
  const state = { _id: { toString: () => userId }, id: userId, email: 'manager@shelflife.com', firstName: 'Development', lastName: 'Manager',
    role: 'Manager', isActive: true, authVersion: 0, passwordHash: overrides.passwordHash, ...overrides.state };
  const writes = [];
  return { state, writes,
    byIdWithHash: async id => id === state.id ? state : null,
    async applyPasswordChange(id, passwordHash) {
      writes.push({ id, passwordHash });
      if (id !== state.id || state.isActive !== true) return false;
      state.passwordHash = passwordHash;
      state.authVersion += 1;
      return true;
    },
  };
}

function appWith(store) {
  const auth = createAuth({ byEmail: async () => null, byId: async id => id === store.state.id ? store.state : null }, secret);
  const passwordChange = createPasswordChange(store);
  return { auth, app: createApp(['http://localhost:8081'], () => true, auth, { passwordChange }) };
}

async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/api/auth`;
}

function tokenFor(store) {
  return jwt.sign({ version: store.state.authVersion }, secret,
    { algorithm: 'HS256', issuer: 'shelflifeai', audience: 'shelflifeai-client', subject: userId, expiresIn: 900 });
}

const meWith = (base, token) => fetch(`${base}/me`, { headers: { Authorization: `Bearer ${token}` } });

test('an authenticated password change verifies the current password, rehashes, and revokes sessions', async t => {
  const store = accountStore({ passwordHash: await hashPassword(currentPassword) });
  const { app } = appWith(store);
  const base = await serve(t, app);
  const change = body => fetch(`${base}/password/change`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(store)}` }, body: JSON.stringify(body) });

  const ok = await change({ currentPassword, newPassword });
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  assert.equal(payload.message, 'Password updated. Sign in again with your new password.');
  // Nothing sensitive is echoed back.
  assert.equal(JSON.stringify(payload).includes(currentPassword), false);
  assert.equal(JSON.stringify(payload).includes(newPassword), false);
  assert.equal(JSON.stringify(payload).includes(store.writes.at(-1).passwordHash), false);
  // The replacement is stored as a fresh hash and the old password no longer verifies.
  assert.equal(await verifyPassword(newPassword, store.state.passwordHash), true);
  assert.equal(await verifyPassword(currentPassword, store.state.passwordHash), false);
  assert.notEqual(store.state.passwordHash, newPassword);
  // The version bump invalidates every credential already issued to this account.
  assert.equal(store.state.authVersion, 1);
  const stale = jwt.sign({ version: 0 }, secret, { algorithm: 'HS256', issuer: 'shelflifeai', audience: 'shelflifeai-client', subject: userId, expiresIn: 900 });
  assert.equal((await meWith(base, stale)).status, 401);
  assert.equal((await meWith(base, tokenFor(store))).status, 200);
});

test('password change rejects a wrong current password and every policy violation without writing', async t => {
  const store = accountStore({ passwordHash: await hashPassword(currentPassword) });
  const { app } = appWith(store);
  const base = await serve(t, app);
  const change = (body, token = tokenFor(store)) => fetch(`${base}/password/change`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  const wrong = await change({ currentPassword: 'not-the-current-password', newPassword });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).error.message, 'Your current password is incorrect');
  for (const body of [{ currentPassword, newPassword: 'too-short' }, { currentPassword }, { newPassword },
    { currentPassword, newPassword: '' }, { currentPassword, newPassword: 'x'.repeat(1025) }, { currentPassword, newPassword: 12345 }]) {
    const rejected = await change(body);
    assert.equal(rejected.status, 400, JSON.stringify(body));
  }
  // Unauthenticated and malformed tokens cannot reach the handler.
  assert.equal((await change({ currentPassword, newPassword }, null)).status, 401);
  assert.equal((await change({ currentPassword, newPassword }, 'malformed')).status, 401);
  // No rejected request produced a write, and the original credential still works.
  assert.equal(store.writes.length, 0);
  assert.equal(store.state.authVersion, 0);
  assert.equal(await verifyPassword(currentPassword, store.state.passwordHash), true);
});

test('the change endpoint only ever targets the caller and never accepts another account', async t => {
  const store = accountStore({ passwordHash: await hashPassword(currentPassword) });
  const { app } = appWith(store);
  const base = await serve(t, app);
  // A body carrying someone else's identity is ignored: the account comes from the token.
  const response = await fetch(`${base}/password/change`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(store)}` },
    body: JSON.stringify({ currentPassword, newPassword, id: 'ffffffffffffffffffffffff', userId: 'ffffffffffffffffffffffff', email: 'admin@shelflife.com', role: 'Super Admin' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(store.writes.map(write => write.id), [userId]);
  assert.equal(store.state.role, 'Manager');
  assert.equal(store.state.email, 'manager@shelflife.com');
  // A deactivated account cannot change its password.
  const inactive = accountStore({ passwordHash: await hashPassword(currentPassword), state: { isActive: false } });
  const second = appWith(inactive);
  const inactiveBase = await serve(t, second.app);
  assert.equal((await fetch(`${inactiveBase}/password/change`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(inactive)}` },
    body: JSON.stringify({ currentPassword, newPassword }) })).status, 401);
  assert.equal(inactive.writes.length, 0);
});

test('the same password-change contract accepts every authenticated application role', async t => {
  for (const role of ['Super Admin', 'Admin', 'Manager', 'Inventory Staff']) {
    const store = accountStore({ passwordHash: await hashPassword(currentPassword), state: { role } });
    const { app } = appWith(store);
    const base = await serve(t, app);
    const response = await fetch(`${base}/password/change`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(store)}` },
      body: JSON.stringify({ currentPassword, newPassword }) });
    assert.equal(response.status, 200, role);
    assert.equal(store.state.role, role);
    assert.equal(store.state.authVersion, 1, role);
    assert.equal(await verifyPassword(newPassword, store.state.passwordHash), true, role);
  }
});

test('the session identity exposes authoritative first and last name fields', () => {
  // Stored values are trimmed by the schema; the identity exposes them as separate fields
  // and the returned parts are trimmed again defensively.
  const user = safeUser({ _id: { toString: () => userId }, email: 'manager@shelflife.com', name: 'Development Manager',
    firstName: '  Development  ', lastName: ' Manager ', role: 'Manager', isActive: true });
  assert.equal(user.firstName, 'Development');
  assert.equal(user.lastName, 'Manager');
  assert.equal(user.name, 'Development Manager');
  // Legacy records without usable name parts fall back to empty strings rather than undefined.
  const legacy = safeUser({ _id: { toString: () => userId }, email: 'legacy@shelflife.com', name: 'Legacy Manager',
    role: 'Manager', isActive: true });
  assert.equal(legacy.firstName, '');
  assert.equal(legacy.lastName, '');
  assert.equal(legacy.name, 'Legacy Manager');
});
