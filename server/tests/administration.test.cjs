const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createAdministration } = require('../dist/services/administration');
const { createAdministrationStore } = require('../dist/services/administration-store');
const { verifyPassword } = require('../dist/services/password');
const { normalizeUserRole, storedUserRoles } = require('../dist/models/user');
const { pagination, auditPagination, accountInput } = require('../dist/validators/administration');

function fixture() {
  let rows = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff', 'Super Admin', 'Admin'].map((role, i) => ({
    id: (i + 1).toString(16).padStart(24, '0'), firstName: 'Test', lastName: String(i), name: `Test ${i}`,
    email: `test${i}@shelflife.com`, role, isActive: true, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  }));
  let records = [], deliveries = [], failAudit = false, hash, lastUpdate;
  const store = {
    get: async id => rows.find(row => row.id === id) ?? null,
    list: async (roles, query, includeActorId) => {
      const found = rows.filter(row => (!roles || roles.includes(row.role) || row.id === includeActorId)
        && (!query.role || (row.id === includeActorId && query.role === 'Admin') || row.role === query.role)
        && (!query.status || row.isActive === (query.status === 'Active'))
        && (!query.search || `${row.firstName} ${row.lastName} ${row.email} ${row.role}`.toLowerCase().includes(query.search.toLowerCase())));
      return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: found.length, page: query.page, pageSize: query.pageSize };
    },
    summary: async (roles = null, activeOnly = false, includeActorId) => {
      const found = rows.filter(row => (!roles || roles.includes(row.role) || row.id === includeActorId) && (!activeOnly || row.isActive));
      return { totalUsers: found.length, activeUsers: found.filter(row => row.isActive).length, inactiveUsers: activeOnly ? 0 : found.filter(row => !row.isActive).length, roleCounts: found.reduce((counts, row) => ({ ...counts, [row.role]: (counts[row.role] ?? 0) + 1 }), {}) };
    },
    audits: async (query, allowedActorRoles) => {
      const found = records.filter(record => (!query.actorRole || record.actor.role === query.actorRole)
        && (!allowedActorRoles || allowedActorRoles.includes(record.actor.role))
        && (!query.action || record.action === query.action)
        && (!query.module || record.module === query.module)
        && (!query.status || record.status === query.status)
        && (!query.search || `${record.actor.name} ${record.actor.role} ${record.action} ${record.module} ${record.details}`.toLowerCase().includes(query.search.toLowerCase()))
        && (!query.from || new Date(record.timestamp) >= query.from)
        && (!query.to || new Date(record.timestamp) <= query.to));
      return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: found.length, page: query.page, pageSize: query.pageSize };
    },
    recordAudit: async (actor, record) => {
      if (failAudit) throw new Error('Audit unavailable');
      records.push({ id: (records.length + 1).toString(16).padStart(24, 'a'), userId: actor.id, actor: { id: actor.id, name: actor.name, role: actor.role }, timestamp: new Date().toISOString(), ...record });
    },
    async transaction(work) {
      const original = structuredClone(rows), originalRecords = structuredClone(records);
      try { return await work({
        get: store.get,
        create: async input => { hash = input.passwordHash; const { passwordHash, ...fields } = input; const row = { ...rows[1], ...fields, name: `${fields.firstName} ${fields.lastName}`, id: 'f'.repeat(24) }; rows.push(row); return row; },
        update: async (id, input) => { lastUpdate = input; const row = rows.find(x => x.id === id); Object.assign(row, input); return row; },
        delete: async id => { rows = rows.filter(row => row.id !== id); },
        audit: async (actor, action, targetId) => {
          if (failAudit) throw new Error('Audit unavailable');
          records.push({ id: (records.length + 1).toString(16).padStart(24, 'a'), userId: actor.id, actor: { id: actor.id, name: actor.name, role: actor.role }, action, targetId, targetType: 'User', module: 'User Management', status: 'Success', timestamp: new Date().toISOString() });
        },
      }); } catch (error) { rows = original; records = originalRecords; throw error; }
    },
  };
  const auth = createAuth({ byId: async id => { const row = await store.get(id); return row ? { ...row, _id: row.id, authVersion: 0, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) } : null; }, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const welcomeEmail = { available: true, send: async (email, name, temporaryPassword, accountEmail) => {
    deliveries.push({ email, name, temporaryPassword, accountEmail });
  } };
  return { store, auth, service: createAdministration(store, welcomeEmail), rows: () => rows, records: () => records, deliveries: () => deliveries, failAudit: () => { failAudit = true; }, hash: () => hash, lastUpdate: () => lastUpdate };
}

test('administration validation rejects injection, unknown fields, role strings and unsafe pagination', () => {
  assert.deepEqual(pagination({}, ['createdAt'], 'createdAt'), { page: 1, pageSize: 25, sortBy: 'createdAt', sortOrder: 'desc' });
  for (const query of [{ page: '0' }, { pageSize: '101' }, { sortBy: '$where' }, { sortOrder: 'other' }, { page: {} }, { role: 'Admin' }]) assert.throws(() => pagination(query, ['createdAt'], 'createdAt'));
  assert.deepEqual(auditPagination({ actorRole: 'Admin', action: 'UPDATE' }), { page: 1, pageSize: 25, sortBy: 'timestamp', sortOrder: 'desc', actorRole: 'Admin', action: 'UPDATE' });
  for (const query of [{ actorRole: 'Staff' }, { action: 'BOGUS' }, { from: 'yesterday' }, { targetId: 'x' }]) assert.throws(() => auditPagination(query));
  for (const body of [{ isActive: false }, { password: 'new-password' }, { authVersion: 0 }, { role: 'Staff' }, { email: { $ne: null } }, { firstName: '' }]) assert.throws(() => accountInput(body, false));
  assert.equal(accountInput({ email: ' VALID@SHELFLIFE.COM ' }, false).email, 'valid@shelflife.com');
});

test('legacy stored roles normalize to the canonical administration role contract', () => {
  assert.equal(normalizeUserRole('Inventory Manager'), 'Manager');
  assert.equal(normalizeUserRole('SuperAdmin'), 'Super Admin');
  assert.equal(normalizeUserRole('InventoryStaff'), 'Inventory Staff');
  assert.equal(normalizeUserRole('Staff'), null);
  assert.deepEqual(storedUserRoles(['Manager']), ['Manager', 'Inventory Manager']);
});

test('administrative writes enforce all actor/target role combinations and self protection', async () => {
  const f = fixture();
  for (const actor of f.rows()) for (const target of f.rows()) {
    const allowed = actor.id !== target.id && (actor.role === 'Super Admin' && ['Admin', 'Manager', 'Inventory Staff'].includes(target.role) || actor.role === 'Admin' && ['Manager', 'Inventory Staff'].includes(target.role));
    if (allowed) await f.service.update(actor, target.id, { firstName: 'Permitted' });
    else await assert.rejects(f.service.update(actor, target.id, { firstName: 'Denied' }), e => e.status === 403);
  }
  const roleChanges = fixture();
  await assert.rejects(roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[2].id, { role: 'Super Admin' }), e => e.status === 403);
  await roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[2].id, { role: 'Inventory Staff' });
  await roleChanges.service.update(roleChanges.rows()[0], roleChanges.rows()[1].id, { role: 'Manager' });
  await assert.rejects(roleChanges.service.update(roleChanges.rows()[1], roleChanges.rows()[3].id, { firstName: 'Denied after demotion' }), e => e.status === 403);
});

test('creation delivers a generated temporary password; lifecycle is idempotent and audit failure rolls changes back', async () => {
  const f = fixture(), actor = f.rows()[0];
  const user = await f.service.create(actor, accountInput({ firstName: 'New', lastName: 'Admin', email: 'new@shelflife.com', personalEmail: 'new.personal@example.com', role: 'Admin' }, true));
  assert.deepEqual(f.deliveries().map(({ email, name, accountEmail }) => ({ email, name, accountEmail })), [{ email: 'new.personal@example.com', name: 'New Admin', accountEmail: 'new@shelflife.com' }]);
  assert.equal(await verifyPassword(f.deliveries()[0].temporaryPassword, f.hash()), true);
  assert.equal(JSON.stringify(user).includes('password'), false);
  await f.service.setActive(actor, user.id, false);
  await f.service.setActive(actor, user.id, false);
  await f.service.setActive(actor, user.id, true);
  assert.deepEqual(f.records().map(x => x.action), ['CREATE', 'DEACTIVATE', 'REACTIVATE']);
  f.failAudit();
  await assert.rejects(f.service.update(actor, user.id, { firstName: 'Must roll back' }));
  assert.equal((await f.store.get(user.id)).firstName, 'New');
});

test('name-only updates omit unchanged identity/role fields from credential invalidation', async () => {
  const f = fixture(), target = f.rows()[1];
  await f.service.update(f.rows()[0], target.id, { firstName: 'Changed', lastName: target.lastName, email: target.email, role: target.role });
  assert.deepEqual(f.lastUpdate(), { firstName: 'Changed' });
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
    const all = await (await call('/api/users', f.rows()[0])).json(); assert.equal(all.total, 6); assert.equal(all.items.filter(x => x.role === 'Super Admin').length, 2);
    const scoped = await (await call('/api/users', f.rows()[1])).json(); assert.deepEqual(scoped.items.map(x => x.role), ['Admin', 'Manager', 'Inventory Staff']);
    assert.equal(scoped.items[0].id, f.rows()[1].id);
    assert.equal(scoped.items[0].name, f.rows()[1].name);
    const ownRoleResponse = await call('/api/users?role=Admin', f.rows()[1]);
    assert.equal((await ownRoleResponse.json()).items.length, 1);
    assert.equal((await call('/api/users?role=Super%20Admin', f.rows()[1])).status, 403);
    assert.equal((await call('/api/users/' + f.rows()[1].id, f.rows()[1])).status, 200);
    assert.equal((await call('/api/users/' + f.rows()[5].id, f.rows()[1])).status, 404);
    assert.equal((await call('/api/users/' + f.rows()[0].id, f.rows()[0], { method: 'DELETE' })).status, 403);
    assert.equal((await call('/api/audit-records', f.rows()[1])).status, 200);
    assert.equal((await call('/api/audit-records?action=DELETE', f.rows()[0])).status, 200);
    assert.equal((await call('/api/audit-records', f.rows()[0], { method: 'POST', body: '{}' })).status, 404);
    assert.deepEqual(await (await call('/api/dashboard/summary', f.rows()[0])).json(), { totalUsers: 6, activeUsers: 6, inactiveUsers: 0, roleCounts: { 'Super Admin': 2, Admin: 2, Manager: 1, 'Inventory Staff': 1 } });
    assert.deepEqual(await (await call('/api/users/summary', f.rows()[1])).json(), { totalUsers: 3, activeUsers: 3, inactiveUsers: 0, roleCounts: { Admin: 1, Manager: 1, 'Inventory Staff': 1 } });
    assert.equal((await call('/api/dashboard/summary', f.rows()[1])).status, 403);
    const old = token(f.rows()[0]); f.rows()[0].role = 'Manager';
    assert.equal((await call('/api/users', old)).status, 403);
    f.rows()[0].isActive = false;
    const denied = await call('/api/users', old); assert.equal(denied.status, 401);
    assert.deepEqual(Object.keys((await denied.json()).error).sort(), ['code', 'details', 'message']);
    assert.equal(/password|authVersion|resetToken|sessionSecret/.test(JSON.stringify(all)), false);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('Super Admin combined account filters are applied before pagination and return accurate empty totals', async () => {
  const f = fixture(), http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const actor = f.rows()[0], token = f.auth.issue({ ...actor, _id: actor.id }).accessToken;
  const request = path => fetch(`http://127.0.0.1:${http.address().port}/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    const query = 'search=test&role=Super%20Admin&status=Active&pageSize=1';
    const first = await (await request(`/users?${query}&page=1`)).json();
    const second = await (await request(`/users?${query}&page=2`)).json();
    assert.equal(first.total, 2); assert.equal(first.page, 1); assert.equal(first.items.length, 1);
    assert.equal(second.total, 2); assert.equal(second.page, 2); assert.equal(second.items.length, 1);
    assert.notEqual(first.items[0].id, second.items[0].id);
    const empty = await (await request('/users?search=no-such-account&role=Super%20Admin&status=Deactivated&page=1')).json();
    assert.equal(empty.total, 0); assert.equal(empty.items.length, 0);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('HTTP lifecycle records the authenticated actor and rejects mass assignment', async () => {
  const f = fixture(), http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const rootToken = f.auth.issue({ ...f.rows()[0], _id: f.rows()[0].id }).accessToken;
  const request = (path, method, body) => fetch(`http://127.0.0.1:${http.address().port}/api${path}`, { method, headers: { Authorization: `Bearer ${rootToken}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const fields = { firstName: 'New', lastName: 'Admin', email: 'new@shelflife.com', personalEmail: 'new.personal@example.com', role: 'Admin' };
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
    const deniedAudit = await fetch(`http://127.0.0.1:${http.address().port}/api/audit-records?page=1&pageSize=1&actorRole=Super%20Admin&action=REACTIVATE&from=2020-01-01T00%3A00%3A00.000Z`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(deniedAudit.status, 403);
    const audit = await fetch(`http://127.0.0.1:${http.address().port}/api/audit-records?page=1&pageSize=1&actorRole=Super%20Admin&action=REACTIVATE&from=2020-01-01T00%3A00%3A00.000Z`, { headers: { Authorization: `Bearer ${rootToken}` } });
    assert.equal(audit.status, 200);
    const filtered = await audit.json();
    assert.equal(filtered.total, 1); assert.equal(filtered.items.length, 1);
    assert.deepEqual(filtered.items[0].actor, { id: f.rows()[0].id, name: f.rows()[0].name, role: 'Super Admin' });
    assert.equal(filtered.items[0].action, 'REACTIVATE');
    const deletedId = user.id;
    const deleted = await request(`/users/${deletedId}`, 'DELETE'); assert.equal(deleted.status, 204);
    assert.equal(await f.store.get(deletedId), null);
    assert.equal(f.records().at(-1).action, 'DELETE');
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('Admin active summary excludes deactivated accounts while keeping them inspectable in the table', async () => {
  const f = fixture();
  f.rows()[2].isActive = false;
  f.rows()[3].isActive = false;
  const http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const actor = f.rows()[1], token = f.auth.issue({ ...actor, _id: actor.id }).accessToken;
  const request = path => fetch(`http://127.0.0.1:${http.address().port}/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    const summary = await (await request('/users/summary')).json();
    assert.deepEqual(summary, { totalUsers: 1, activeUsers: 1, inactiveUsers: 0, roleCounts: { Admin: 1 } });
    const table = await (await request('/users?status=Deactivated')).json();
    assert.deepEqual(table.items.map(row => row.role), ['Manager', 'Inventory Staff']);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('Super Admin summary reconciles lifecycle totals and counts deactivated Super Admins', async () => {
  const f = fixture();
  f.rows()[2].isActive = false;
  f.rows()[4].isActive = false;
  const http = createServer(createApp([], () => true, f.auth, undefined, f.service));
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const actor = f.rows()[0], token = f.auth.issue({ ...actor, _id: actor.id }).accessToken;
  try {
    const response = await fetch(`http://127.0.0.1:${http.address().port}/api/dashboard/summary`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const summary = await response.json();
    assert.equal(summary.totalUsers, 6);
    assert.equal(summary.activeUsers, 4);
    assert.equal(summary.inactiveUsers, 2);
    assert.equal(summary.activeUsers + summary.inactiveUsers, summary.totalUsers);
    assert.equal(summary.roleCounts['Super Admin'], 2);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});

test('account summary returns zero totals and empty role counts for an empty account collection', async () => {
  const users = { aggregate: () => ({ exec: async () => [] }) };
  const store = createAdministrationStore({}, users, {});
  assert.deepEqual(await store.summary(), { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, roleCounts: {} });
});

test('audit status filtering agrees with the model default the Status column presents', async () => {
  // The status model is Success | Failed | Warning with default 'Success'
  // (models/audit-record.ts), and every presentation surface reads a missing
  // stored status as Success. The query filter has to agree with them, or a
  // Status=Success request silently drops rows the same table labels Success.
  const seen = [];
  const auditQuery = (rows) => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return this; },
    exec: async () => rows,
  });
  const audits = {
    find(filter) { seen.push(['find', filter.status]); return auditQuery([]); },
    countDocuments(filter) { seen.push(['count', filter.status]); return { exec: async () => 0 }; },
  };
  const users = { find() { return { select() { return this; }, lean() { return this; }, exec: async () => [] }; } };
  const store = createAdministrationStore({}, users, audits);
  const base = { page: 1, pageSize: 25, sortBy: 'timestamp', sortOrder: 'desc' };
  // Success matches stored Success plus an absent field (the model default).
  await store.audits({ ...base, status: 'Success' }, null);
  assert.deepEqual(seen, [['find', { $in: ['Success', null] }], ['count', { $in: ['Success', null] }]]);
  // Failed and Warning stay exact: a missing status can never be one of those.
  for (const status of ['Failed', 'Warning']) {
    seen.length = 0;
    await store.audits({ ...base, status }, null);
    assert.deepEqual(seen, [['find', status], ['count', status]]);
  }
  // With no status filter the collection-wide total is untouched.
  seen.length = 0;
  await store.audits(base, null);
  assert.deepEqual(seen, [['find', undefined], ['count', undefined]]);
});

test('account listing sorts login recency with creation and id tie-breakers before pagination', async () => {
  const calls = [];
  const query = {
    select() { return this; },
    sort(value) { calls.push(['sort', value]); return this; },
    skip(value) { calls.push(['skip', value]); return this; },
    limit(value) { calls.push(['limit', value]); return this; },
    lean() { return this; },
    exec: async () => [],
  };
  const users = {
    find: () => query,
    countDocuments: () => ({ exec: async () => 0 }),
  };
  const store = createAdministrationStore({}, users, {});
  await store.list(null, { page: 2, pageSize: 10, sortBy: 'lastLoginAt', sortOrder: 'desc' });
  assert.deepEqual(calls, [
    ['sort', { lastLoginAt: -1, createdAt: -1, _id: -1 }],
    ['skip', 10],
    ['limit', 10],
  ]);
});

test('Admin audit filters are server-side and XLSX exports record the authenticated actor', async () => {
  const f = fixture(), actor = f.rows()[1];
  f.rows()[2].name = 'Manager Actor';
  const workbook = await f.service.exportAudits(actor, { page: 1, pageSize: 25, sortBy: 'timestamp', sortOrder: 'desc' });
  assert.ok(workbook.byteLength > 0);
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const opened = new Workbook();
  await opened.xlsx.load(workbook);
  const sheet = opened.getWorksheet('Audit Records');
  assert.deepEqual(sheet.getRow(4).values.slice(1), ['Date & Time', 'User', 'Action', 'Module', 'Details', 'Status']);
  assert.equal(sheet.getRow(4).fill.fgColor.argb, 'FF11613C');
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.views[0].ySplit, 4);
  assert.equal(f.records().length, 1);
  assert.equal(f.records()[0].userId, actor.id);
  assert.equal(f.records()[0].actor.role, 'Admin');
  assert.equal(f.records()[0].status, 'Success');
  assert.equal(f.records()[0].action, 'EXPORT');
  assert.equal(f.records()[0].targetName, 'Audit records XLSX');
  const result = await f.service.audits(actor, { page: 1, pageSize: 25, sortBy: 'timestamp', sortOrder: 'desc' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].actor.role, 'Admin');
  assert.equal(result.items[0].detailsDisplay, 'Exported audit records to XLSX (0 records).');
});
