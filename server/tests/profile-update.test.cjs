const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createProfileUpdate } = require('../dist/services/profile-update');
const { safeUser } = require('../dist/models/user');
const secret = randomBytes(48).toString('hex');
const userId = '0123456789abcdef01234567';

// An in-memory account that mirrors the real store: the write only lands while the stored name
// parts still hold the values the caller was shown, exactly as the guarded update does.
function accountStore(overrides = {}) {
  const state = { _id: { toString: () => userId }, id: userId, email: 'manager@shelflife.com',
    firstName: 'Development', lastName: 'Manager', name: 'Development Manager',
    role: 'Manager', isActive: true, authVersion: 0, ...overrides.state };
  const writes = [];
  return { state, writes,
    byId: async id => id === state.id ? state : null,
    async applyName(id, expected, next) {
      writes.push({ id, expected, next });
      if (id !== state.id || state.isActive !== true) return false;
      if (state.firstName !== expected.firstName || state.lastName !== expected.lastName) return false;
      state.firstName = next.firstName; state.lastName = next.lastName; state.name = next.name;
      return true;
    },
  };
}

function appWith(store, audit) {
  const auth = createAuth({ byEmail: async () => null, byId: async id => id === store.state.id ? store.state : null }, secret);
  return createApp(['http://localhost:8081'], () => true, auth, { profileUpdate: createProfileUpdate(store, audit) });
}

async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/api/auth`;
}

const tokenFor = (store, version = store.state.authVersion) => jwt.sign({ version }, secret,
  { algorithm: 'HS256', issuer: 'shelflifeai', audience: 'shelflifeai-client', subject: userId, expiresIn: 900 });

const patch = (base, body, token) => fetch(`${base}/profile`, { method: 'PATCH',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test('a signed-in account updates its own name parts and the canonical display name follows', async t => {
  const store = accountStore();
  const audits = [];
  const base = await serve(t, appWith(store, async (actor, details) => audits.push({ actor, details })));

  const response = await patch(base, { firstName: '  Ana  ', lastName: 'Reyes' }, tokenFor(store));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.message, 'Your details have been updated.');
  // The stored value is trimmed, and the combined name is kept in step with the parts.
  assert.equal(store.state.firstName, 'Ana');
  assert.equal(store.state.lastName, 'Reyes');
  assert.equal(store.state.name, 'Ana Reyes');
  // The returned identity is the safe projection: no hash, token or internal field.
  assert.deepEqual(payload.user.firstName, 'Ana');
  assert.equal(payload.user.lastName, 'Reyes');
  assert.equal(payload.user.name, 'Ana Reyes');
  assert.equal(JSON.stringify(payload).includes('passwordHash'), false);
  assert.equal(JSON.stringify(payload).includes('authVersion'), false);
  // A sensitive account change is recorded without any credential or secret.
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actor.id, userId);
  assert.match(audits[0].details, /first name, last name/);
  // The record names the account (its own display name, as every audit record does) and the
  // fields that changed; it never carries a credential, token or submitted value.
  assert.equal(audits[0].actor.name, 'Ana Reyes');
  assert.equal(/password|hash|token|scrypt/i.test(JSON.stringify(audits[0].details)), false);
});

test('one name part can be changed alone and an unchanged value is a no-op', async t => {
  const store = accountStore();
  const base = await serve(t, appWith(store));

  const single = await patch(base, { lastName: 'Cruz' }, tokenFor(store));
  assert.equal(single.status, 200);
  assert.equal(store.state.firstName, 'Development');
  assert.equal(store.state.lastName, 'Cruz');
  assert.equal(store.state.name, 'Development Cruz');
  assert.equal(store.writes.length, 1);

  // Repeating the stored value reports that nothing changed and writes nothing.
  const repeated = await patch(base, { lastName: 'Cruz' }, tokenFor(store));
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).message, 'Your details are already up to date.');
  assert.equal(store.writes.length, 1);
});

test('the same self-only profile contract accepts every authenticated application role', async t => {
  for (const role of ['Super Admin', 'Admin', 'Manager', 'Inventory Staff']) {
    const store = accountStore({ state: { role } });
    const base = await serve(t, appWith(store));
    const response = await patch(base, { firstName: 'RoleQA' }, tokenFor(store));
    assert.equal(response.status, 200, role);
    assert.equal(store.state.firstName, 'RoleQA', role);
    assert.equal(store.state.role, role);
    assert.deepEqual(store.writes.map(write => write.id), [userId]);
  }
});

test('invalid names are rejected without writing', async t => {
  const store = accountStore();
  const base = await serve(t, appWith(store));
  const token = tokenFor(store);
  for (const body of [{ firstName: '' }, { firstName: '   ' }, { firstName: 'x'.repeat(26) },
    { lastName: 'x'.repeat(26) }, { firstName: 42 }, { lastName: null }, { firstName: {} }, {}]) {
    const rejected = await patch(base, body, token);
    assert.equal(rejected.status, 400, JSON.stringify(body));
  }
  assert.equal(store.writes.length, 0);
  assert.equal(store.state.firstName, 'Development');
  assert.equal(store.state.lastName, 'Manager');
});

test('role, status, email and credential fields cannot be changed from a profile request', async t => {
  const store = accountStore();
  const audits = [];
  const base = await serve(t, appWith(store, async (actor, details) => audits.push({ actor, details })));
  const token = tokenFor(store);
  for (const body of [
    { role: 'Super Admin' }, { firstName: 'Ana', role: 'Super Admin' },
    { isActive: false }, { email: 'other@shelflife.com' },
    { passwordHash: 'scrypt$0' }, { password: 'plaintext-password' }, { authVersion: 99 }, { id: 'ffffffffffffffffffffffff' },
  ]) {
    const rejected = await patch(base, body, token);
    assert.equal(rejected.status, 400, JSON.stringify(body));
  }
  // Nothing privileged moved, and no audit record claims a change that never happened.
  assert.equal(store.state.role, 'Manager');
  assert.equal(store.state.isActive, true);
  assert.equal(store.state.email, 'manager@shelflife.com');
  assert.equal(store.state.authVersion, 0);
  assert.equal(store.writes.length, 0);
  assert.equal(audits.length, 0);
});

test('the profile endpoint only ever targets the caller and requires a valid session', async t => {
  const store = accountStore();
  const base = await serve(t, appWith(store));

  // No token, a malformed token and a token signed with the wrong secret all fail closed.
  assert.equal((await patch(base, { firstName: 'Ana' }, null)).status, 401);
  assert.equal((await patch(base, { firstName: 'Ana' }, 'malformed')).status, 401);
  assert.equal((await patch(base, { firstName: 'Ana' }, jwt.sign({ version: 0 }, 'wrong-secret', { algorithm: 'HS256', issuer: 'shelflifeai', audience: 'shelflifeai-client', subject: userId, expiresIn: 900 }))).status, 401);
  assert.equal(store.writes.length, 0);

  // A token issued before a credential change is refused by the version check.
  const stale = tokenFor(store, 5);
  assert.equal((await patch(base, { firstName: 'Ana' }, stale)).status, 401);
  assert.equal(store.writes.length, 0);

  // A deactivated account cannot edit its own profile.
  const inactive = accountStore({ state: { isActive: false } });
  const inactiveBase = await serve(t, appWith(inactive));
  assert.equal((await patch(inactiveBase, { firstName: 'Ana' }, tokenFor(inactive))).status, 401);
  assert.equal(inactive.writes.length, 0);
});

test('a competing write between the read and the write is refused instead of overwritten', async t => {
  // The guard closes the window inside one request: the name parts only land while they still
  // hold the values the request read. Here another write lands in that window.
  const store = accountStore();
  const base = await serve(t, appWith(store));
  const read = store.byId;
  store.byId = async id => {
    const snapshot = await read(id);
    // A second writer changes the stored name after this request has read it. The copy is
    // returned so the mutation cannot leak into the value the request already holds.
    store.byId = read;
    if (!snapshot) return snapshot;
    const before = { ...snapshot };
    store.state.firstName = 'Someone'; store.state.name = 'Someone Manager';
    return before;
  };
  const conflict = await patch(base, { firstName: 'Ana' }, tokenFor(store));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.message, 'Your details changed while you were editing. Reload the page and try again');
  assert.equal(store.state.firstName, 'Someone');
  assert.equal(store.state.name, 'Someone Manager');
});

test('the session identity still exposes authoritative first and last name fields', () => {
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
