const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createAdministration } = require('../dist/services/administration');
const { verifyPassword } = require('../dist/services/password');
const { pagination, auditPagination, accountInput } = require('../dist/validators/administration');

function fixture() {
  let rows = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff', 'Super Admin', 'Admin'].map((role, i) => ({
    id: (i + 1).toString(16).padStart(24, '0'), firstName: 'Test', lastName: String(i), name: `Test ${i}`,
    email: `test${i}@shelflife.com`, role, isActive: true, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  }));
  let records = [], failAudit = false, hash, lastUpdate;
  const store = {
    get: async id => rows.find(row => row.id === id) ?? null,
    list: async (roles, query) => { const found = rows.filter(row => !roles || roles.includes(row.role)); return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: found.length, page: query.page, pageSize: query.pageSize }; },
    summary: async () => ({ totalUsers: rows.length, activeUsers: rows.filter(x => x.isActive).length, inactiveUsers: rows.filter(x => !x.isActive).length }),
    audits: async query => {
      const found = records.filter(record => (!query.actorRole || record.actor.role === query.actorRole)
        && (!query.action || record.action === query.action)
        && (!query.from || new Date(record.timestamp) >= query.from));
      return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: found.length, page: query.page, pageSize: query.pageSize };
    },
    async transaction(work) {
      const original = structuredClone(rows), originalRecords = structuredClone(records);
      try { return await work({
        get: store.get,
        create: async input => { hash = input.passwordHash; const { passwordHash, ...fields } = input; const row = { ...rows[1], ...fields, id: 'f'.repeat(24) }; rows.push(row); return row; },
        update: async (id, input) => { lastUpdate = input; const row = rows.find(x => x.id === id); Object.assign(row, input); return row; },
        audit: async (userId, action, targetId, oldValue, newValue) => {
          if (failAudit) throw new Error('Audit unavailable');
          const actor = rows.find(row => row.id === userId);
          records.push({ oldValue, newValue, id: (records.length + 1).toString(16).padStart(24, 'a'), userId, actor: { id: userId, name: actor.name, role: actor.role }, action, targetId, targetType: 'User', timestamp: new Date().toISOString() });
        },
      }); } catch (error) { rows = original; records = originalRecords; throw error; }
    },
  };
  const auth = createAuth({ byId: async id => { const row = await store.get(id); return row ? { ...row, _id: row.id, authVersion: 0 } : null; }, byEmail: async () => null }, randomBytes(48).toString('hex'));
  return { store, auth, service: createAdministration(store), rows: () => rows, records: () => records, failAudit: () => { failAudit = true; }, hash: () => hash, lastUpdate: () => lastUpdate };
}

test('administration validation rejects injection, unknown fields, role strings and unsafe pagination', () => {
  assert.deepEqual(pagination({}, ['createdAt'], 'createdAt'), { page: 1, pageSize: 25, sortBy: 'createdAt', sortOrder: 'desc' });
  for (const query of [{ page: '0' }, { pageSize: '101' }, { sortBy: '$where' }, { sortOrder: 'other' }, { page: {} }, { role: 'Admin' }]) assert.throws(() => pagination(query, ['createdAt'], 'createdAt'));
  assert.deepEqual(auditPagination({ actorRole: 'Admin', action: 'UPDATE' }), { page: 1, pageSize: 25, sortBy: 'timestamp', sortOrder: 'desc', actorRole: 'Admin', action: 'UPDATE' });
  for (const query of [{ actorRole: 'Staff' }, { action: 'PURGE' }, { from: 'yesterday' }, { targetId: 'x' }]) assert.throws(() => auditPagination(query));
  for (const body of [{ isActive: false }, { password: 'new-password' }, { authVersion: 0 }, { role: 'Staff' }, { email: { $ne: null } }, { firstName: '' }]) assert.throws(() => accountInput(body, false));
  assert.equal(accountInput({ email: ' VALID@SHELFLIFE.COM ' }, false).email, 'valid@shelflife.com');
});

test('administrative writes enforce all actor/target role combinations and self protection', async () => {
  const f = fixture();
  for (const actor of f.rows()) for (const target of f.rows()) {
    const allowed = actor.id !== target.id && (actor.role === 'Super Admin' && ['Admin', 'Inventory Manager', 'Inventory Staff'].includes(target.role) || actor.role === 'Admin' && ['Inventory Manager', 'Inventory Staff'].includes(target.role));
    if (allowed) await f.service.update(actor, target.id, { firstName: 'Permitted' });
    else await assert.rejects(f.service.update(actor, target.id, { firstName: 'Denied' }), e => e.status === 403);
  }
  const roleChanges = fixture();
  await assert.rejects(roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[2].id, { role: 'Super Admin' }), e => e.status === 403);
  await roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[2].id, { role: 'Inventory Staff' });
  await roleChanges.service.update(roleChanges.rows()[0], roleChanges.rows()[1].id, { role: 'Inventory Manager' });
  await assert.rejects(roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[3].id, { firstName: 'Denied after demotion' }), e => e.status === 403);
});

test('creation hashes passwords; lifecycle is idempotent and audit failure rolls changes back', async () => {
  const f = fixture(), actor = f.rows()[0];
  const user = await f.service.create(actor, accountInput({ firstName: 'New', lastName: 'Admin', email: 'new@shelflife.com', role: 'Admin', password: 'isolated-test-password' }, true));
  assert.equal(await verifyPassword('isolated-test-password', f.hash()), true);
  assert.equal(JSON.stringify(user).includes('password'), false);
  await f.service.setActive(actor, user.id, false);
  await f.service.setActive(actor, user.id, false);
  await f.service.setActive(actor, user.id, true);
  assert.deepEqual(f.records().map(x => x.action), ['CREATE', 'DEACTIVATE', 'REACTIVATE']);
  assert.equal(f.records()[0].oldValue, null);
  assert.equal(f.records()[0].newValue.isActive, true);
  assert.equal(f.records()[1].oldValue.isActive, true);
  assert.equal(f.records()[1].newValue.isActive, false);
  assert.equal(f.records()[2].oldValue.isActive, false);
  assert.equal(f.records()[2].newValue.isActive, true);
  assert.equal(/password|authVersion|resetToken/.test(JSON.stringify(f.records())), false);
  f.failAudit();
  await assert.rejects(f.service.update(actor, user.id, { firstName: 'Must roll back' }));
  assert.equal((await f.store.get(user.id)).firstName, 'New');
});

test('name-only updates omit unchanged identity/role fields from credential invalidation', async () => {
  const f = fixture(), target = f.rows()[1];
  await f.service.update(f.rows()[0], target.id, { firstName: 'Changed', lastName: target.lastName, email: target.email, role: target.role });
  assert.deepEqual(f.lastUpdate(), { firstName: 'Changed' });
  assert.equal(f.records()[0].oldValue.firstName, 'Test');
  assert.equal(f.records()[0].newValue.firstName, 'Changed');
});

test('real HTTP administration checks authentication before authorization and validation, current roles, safe data and read-only audit', async () => {
  const f = fixture(), http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  const token = row => f.auth.issue({ ...row, _id: row.id }).accessToken;
  const call = (path, actor, options = {}) => fetch(base + path, { ...options, headers: { ...(actor ? { Authorization: `Bearer ${typeof actor === 'string' ? actor : token(actor)}` } : {}), 'Content-Type': 'application/json' } });
  try {
    assert.equal((await call('/api/users?page=bad')).status, 401);
    assert.equal((await call('/api/users?page=bad', f.rows()[2])).status, 403);
    assert.equal((await call('/api/users?page=bad', f.rows()[0])).status, 400);
    assert.equal((await call('/api/users', undefined, { method: 'POST', body: '{' })).status, 401);
    assert.equal((await call('/api/users', f.rows()[2], { method: 'POST', body: '{' })).status, 403);
    const malformed = await call('/api/users', f.rows()[0], { method: 'POST', body: '{' });
    assert.equal(malformed.status, 400); assert.equal((await malformed.json()).error.code, 'VALIDATION_ERROR');
    const all = await (await call('/api/users', f.rows()[0])).json(); assert.equal(all.total, 6); assert.ok(all.items.some(x => x.role === 'Super Admin'));
    const scoped = await (await call('/api/users', f.rows()[1])).json(); assert.deepEqual(scoped.items.map(x => x.role), ['Inventory Manager', 'Inventory Staff']);
    assert.equal((await call('/api/users/' + f.rows()[0].id, f.rows()[1])).status, 404);
    assert.equal((await call('/api/users/' + f.rows()[1].id, f.rows()[0], { method: 'DELETE' })).status, 404);
    assert.equal((await call('/api/audit-records', f.rows()[1])).status, 200);
    assert.equal((await call('/api/audit-records?action=PURGE', f.rows()[0])).status, 400);
    assert.equal((await call('/api/audit-records', f.rows()[0], { method: 'POST', body: '{}' })).status, 404);
    assert.deepEqual(await (await call('/api/dashboard/summary', f.rows()[0])).json(), { totalUsers: 6, activeUsers: 6, inactiveUsers: 0 });
    assert.equal((await call('/api/dashboard/summary', f.rows()[1])).status, 403);
    const old = token(f.rows()[0]); f.rows()[0].role = 'Inventory Manager';
    assert.equal((await call('/api/users', old)).status, 403);
    f.rows()[0].isActive = false;
    const denied = await call('/api/users', old); assert.equal(denied.status, 401);
    assert.deepEqual(Object.keys((await denied.json()).error).sort(), ['code', 'details', 'message']);
    assert.equal(/password|authVersion|resetToken|sessionSecret/.test(JSON.stringify(all)), false);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('HTTP lifecycle records the authenticated actor and rejects mass assignment', async () => {
  const f = fixture(), http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const token = f.auth.issue({ ...f.rows()[0], _id: f.rows()[0].id }).accessToken;
  const request = (path, method, body) => fetch(`http://127.0.0.1:${http.address().port}/api${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const fields = { firstName: 'New', lastName: 'Admin', email: 'new@shelflife.com', role: 'Admin', password: 'isolated-test-password' };
    assert.equal((await request('/users', 'POST', { ...fields, userId: f.rows()[2].id })).status, 400);
    assert.equal((await request('/users', 'POST', { ...fields, role: 'Super Admin' })).status, 403);
    const created = await request('/users', 'POST', fields); assert.equal(created.status, 201);
    const { user } = await created.json(); assert.equal('passwordHash' in user, false);
    assert.equal((await request(`/users/${user.id}`, 'PATCH', { isActive: false })).status, 400);
    assert.equal((await request(`/users/${user.id}`, 'PATCH', { lastName: 'Updated' })).status, 200);
    assert.equal((await request(`/users/${user.id}/deactivate`, 'POST')).status, 200);
    assert.equal((await request(`/users/${user.id}/reactivate`, 'POST')).status, 200);
    assert.deepEqual(f.records().map(x => x.action), ['CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE']);
    assert.ok(f.records().every(x => x.userId === f.rows()[0].id && x.targetId === user.id));
    const adminToken = f.auth.issue({ ...f.rows()[1], _id: f.rows()[1].id }).accessToken;
    const audit = await fetch(`http://127.0.0.1:${http.address().port}/api/audit-records?page=1&pageSize=1&actorRole=Super%20Admin&action=REACTIVATE&from=2020-01-01T00%3A00%3A00.000Z`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(audit.status, 200);
    const filtered = await audit.json();
    assert.equal(filtered.total, 1); assert.equal(filtered.items.length, 1);
    assert.deepEqual(filtered.items[0].actor, { id: f.rows()[0].id, name: f.rows()[0].name, role: 'Super Admin' });
    assert.equal(filtered.items[0].action, 'REACTIVATE');
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('password-setting paths reject whitespace only and preserve significant edge spaces', async () => {
  const { readDevAdmin } = require('../dist/config/auth');
  const f = fixture(), password = '  valid-password-only  ';
  const fields = { firstName: 'New', lastName: 'Admin', email: 'new@shelflife.com', role: 'Admin' };
  const env = { NODE_ENV: 'development', DEV_ADMIN_EMAIL: fields.email, DEV_ADMIN_FIRST_NAME: fields.firstName, DEV_ADMIN_LAST_NAME: fields.lastName };
  for (const blank of ['', ' '.repeat(12), '\t\n '.repeat(12)]) {
    assert.throws(() => accountInput({ ...fields, password: blank }, true), error => error.status === 400 && error.details.some(detail => detail.field === 'password'));
    assert.throws(() => readDevAdmin({ ...env, DEV_ADMIN_PASSWORD: blank }), /DEV_ADMIN_PASSWORD/);
  }
  const input = accountInput({ ...fields, password }, true);
  assert.equal(input.password, password);
  await f.service.create(f.rows()[0], input);
  assert.equal(await verifyPassword(password, f.hash()), true);
  assert.equal(await verifyPassword(password.trim(), f.hash()), false);
  assert.equal(readDevAdmin({ ...env, DEV_ADMIN_PASSWORD: password }).password, password);
  assert.throws(() => accountInput({ password }, false)); // No admin-reset path on account PATCH.
});

test('both HTTP lifecycle endpoints reject arrays and non-objects but accept empty or absent bodies', async () => {
  const f = fixture(), http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const token = f.auth.issue({ ...f.rows()[0], _id: f.rows()[0].id }).accessToken;
  try {
    for (const action of ['deactivate', 'reactivate']) {
      for (const body of ['[]', '[{}]', 'null', 'false', '0', '""', '{"extra":true}']) {
        const response = await fetch(`http://127.0.0.1:${http.address().port}/api/users/${f.rows()[1].id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
        assert.equal(response.status, 400, `${action}: ${body}`);
        assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
      }
      for (const body of ['{}', undefined]) {
        const response = await fetch(`http://127.0.0.1:${http.address().port}/api/users/${f.rows()[1].id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body }) });
        assert.equal(response.status, 200, `${action}: ${body}`);
        assert.equal((await response.json()).user.isActive, action === 'reactivate');
      }
    }
    const { administrationControllers } = require('../dist/controllers/administration.controller');
    for (const action of ['deactivate', 'reactivate']) {
      for (const body of [new Date(), new Map(), Object.create({ inherited: true })]) {
        await assert.rejects(administrationControllers(f.service)[action]({ body }, {}), error => error.status === 400);
      }
    }
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
