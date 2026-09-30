const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { createApp } = require('../dist/app');
const { auditPagination } = require('../dist/validators/administration');
const { auditSnapshot } = require('../dist/services/audit-snapshot');
const { createInventoryBatches } = require('../dist/services/inventory-batches');
const { createSystemConfig } = require('../dist/services/system-config');
const { HttpError } = require('../dist/middleware/error.middleware');

const auth = { authenticate: async header => {
  if (!header) throw new HttpError(401, 'Authentication required');
  return { id: '1'.repeat(24), role: header.slice(7) };
} };
async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return (method, path, role, body) => fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('all ID routes reject malformed IDs before invoking a data service', async t => {
  let calls = 0;
  const service = new Proxy({}, { get: () => async () => { calls++; throw new Error('Data service must not run'); } });
  const call = await serve(t, createApp([], () => true, auth, undefined, service, service, service, service, service, service, service));
  const ingredient = { name: 'Milk', category: 'Dairy', unitOfMeasure: 'L', expectedVersion: 0 };
  const routes = [
    ['GET', '/users/not-an-id', 'Super Admin'],
    ['PATCH', '/users/not-an-id', 'Super Admin', { firstName: 'Valid' }],
    ['POST', '/users/not-an-id/deactivate', 'Super Admin', {}],
    ['POST', '/users/not-an-id/reactivate', 'Super Admin', {}],
    ['PATCH', '/account-requests/not-an-id/review', 'Super Admin', { decision: 'Rejected', expectedVersion: 0 }],
    ['DELETE', '/account-requests/not-an-id', 'Super Admin'],
    ['PATCH', '/ingredients/not-an-id', 'Inventory Manager', ingredient],
    ['DELETE', '/ingredients/not-an-id', 'Inventory Manager', { expectedVersion: 0 }],
    ['GET', '/inventory-batches/not-an-id', 'Inventory Staff'],
    ['PATCH', '/inventory-batches/not-an-id', 'Inventory Manager', {}],
    ['POST', '/inventory-batches/not-an-id/quantity-corrections', 'Inventory Manager', {}],
    ['DELETE', '/inventory-batches/not-an-id', 'Inventory Manager', {}],
    ['PATCH', '/change-requests/not-an-id', 'Inventory Staff', {}],
    ['DELETE', '/change-requests/not-an-id', 'Inventory Staff'],
    ['PATCH', '/ingredient-requests/not-an-id', 'Inventory Staff', ingredient],
    ['PATCH', '/ingredient-requests/not-an-id/review', 'Inventory Manager', { decision: 'Rejected', expectedVersion: 0 }],
    ['DELETE', '/ingredient-requests/not-an-id', 'Inventory Manager'],
  ];
  for (const route of routes) { const response = await call(...route); assert.equal(response.status, 400, route.join(' ')); assert.equal((await response.json()).error.code, 'VALIDATION_ERROR'); }
  assert.equal(calls, 0);
});

test('protected fields and malformed business inputs cannot reach persistence', async t => {
  let calls = 0;
  const trap = new Proxy({}, { get: () => () => { calls++; throw new Error('Persistence must not run'); } });
  const config = createSystemConfig({ connection: trap }, trap, trap);
  const batches = createInventoryBatches({ connection: trap }, trap, trap, trap, config);
  const call = await serve(t, createApp([], () => true, auth, undefined, trap, trap, config, batches));
  const id = '1'.repeat(24), account = { firstName: 'Test', lastName: 'User', email: 'test@shelflife.com', role: 'Inventory Staff', password: 'valid-test-password' };
  const ingredient = { name: 'Milk', category: 'Dairy', unitOfMeasure: 'L' };
  const batch = { ingredientId: id, batchCode: 'TEST', initialQuantity: '1.000', unit: 'L', unitCost: '2.0000', dateReceived: '2026-09-24', expirationDate: '2026-09-25' };
  const routes = [
    ['POST', '/users', 'Super Admin', account], ['PATCH', `/users/${id}`, 'Super Admin', { firstName: 'Test' }],
    ['POST', '/ingredients', 'Inventory Staff', ingredient], ['PATCH', `/ingredients/${id}`, 'Inventory Manager', { expectedVersion: 0, name: 'Milk' }],
    ['DELETE', `/ingredients/${id}`, 'Inventory Manager', { expectedVersion: 0 }],
    ['POST', '/inventory-batches', 'Inventory Manager', batch], ['PATCH', `/inventory-batches/${id}`, 'Inventory Manager', { expectedVersion: 0, unit: 'L' }],
    ['POST', `/inventory-batches/${id}/quantity-corrections`, 'Inventory Manager', { expectedVersion: 0, correctedQuantity: '1.000', approved: true, reason: 'Test' }],
    ['DELETE', `/inventory-batches/${id}`, 'Inventory Manager', { expectedVersion: 0 }],
    ['PATCH', '/system-config', 'Super Admin', { expectedVersion: 0, criticalDays: 2 }],
  ];
  for (const [method, path, role, body] of routes) for (const field of ['isActive', 'passwordHash', 'version', 'createdBy', 'authVersion', ...(path.startsWith('/users') ? [] : ['role']), ...(path.startsWith('/inventory-batches') ? ['status', 'quantity'] : [])]) {
    const response = await call(method, path, role, { ...body, [field]: 'attacker-value' });
    assert.equal(response.status, 400, `${method} ${path} ${field}`);
  }
  for (const invalid of [{ ...batch, initialQuantity: '-1' }, { ...batch, expirationDate: '2026-02-30' }, { ...batch, batchCode: 'x'.repeat(101) }, { ...batch, unit: 'arbitrary' }]) assert.equal((await call('POST', '/inventory-batches', 'Inventory Manager', invalid)).status, 400);
  assert.equal(calls, 0);
});

test('audit date filters reject normalized impossible dates and ambiguous formats', () => {
  for (const value of ['2026-02-30', '2025-02-29', '09/24/2026', '1', '2026-09-24T24:00:00Z', '2026-09-24T00:00:00', 'x'.repeat(10000)]) {
    for (const field of ['from', 'to']) assert.throws(() => auditPagination({ [field]: value }), error => error.status === 400);
  }
  for (const value of ['2024-02-29', '2026-09-24T12:30:59Z', '2026-09-24T12:30:59.123Z']) assert.equal(auditPagination({ from: value }).from.toISOString(), new Date(value).toISOString());
});

test('request audit snapshots retain distinct account and ingredient request labels', () => {
  assert.deepEqual(auditSnapshot('AccountRequest', { id: 'account-request', email: 'test@shelflife.com', role: 'Inventory Staff', name: 'Excluded' }), { id: 'account-request', email: 'test@shelflife.com', role: 'Inventory Staff' });
  assert.deepEqual(auditSnapshot('IngredientRequest', { id: 'ingredient-request', name: 'Milk', category: 'Dairy', unitOfMeasure: 'L', email: 'Excluded' }), { id: 'ingredient-request', name: 'Milk', category: 'Dairy', unitOfMeasure: 'L' });
});

test('every auth endpoint rejects Mongo operator keys before its handler', async t => {
  let calls = 0;
  const trap = new Proxy({}, { get: () => () => { calls++; throw new Error('Auth handler must not run'); } });
  const call = await serve(t, createApp([], () => true, trap, { sessions: trap, recovery: trap }));
  for (const path of ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/password-reset/request', '/auth/password-reset/complete']) {
    assert.equal((await call('POST', path, undefined, { email: { $ne: null }, password: { $gt: '' } })).status, 400, path);
  }
  for (const path of ['/auth/me', '/auth/password-reset/availability']) assert.equal((await call('GET', path + '?%24where=x')).status, 400, path);
  assert.equal(calls, 0);
});

test('all error handlers redact internal errors and diagnose every current business scope', async t => {
  const logs = [], original = console.warn;
  console.warn = line => logs.push(JSON.parse(line));
  try {
    const fail = () => { throw Object.assign(new Error('secret-password mongodb://secret-host stack-secret'), { code: 12345 }); };
    const service = new Proxy({}, { get: () => fail });
    const call = await serve(t, createApp([], fail, { ...auth, login: fail }, undefined, service, service, service, service, service, service, service));
    for (const path of ['/health/ready', '/users', '/ingredients', '/inventory-batches', '/system-config', '/account-requests', '/ingredient-requests', '/change-requests']) {
      const response = await call('GET', path, 'Super Admin');
      assert.equal(response.status, 500, path);
      const body = await response.text(); assert(!/secret-password|secret-host|stack-secret/.test(body));
      const event = logs.find(log => log.requestId === response.headers.get('x-request-id'));
      assert(event); assert.equal(event.status, response.status);
    }
    const rejected = await call('GET', '/users?secret-query=private', 'Super Admin');
    assert.equal(rejected.status, 400);
    assert(!/secret-password|secret-host|stack-secret|secret-query|private|Bearer/.test(JSON.stringify(logs)));
    assert(logs.some(log => log.databaseCode === 12345));
    for (const log of logs) assert.deepEqual(Object.keys(log).filter(key => !['event', 'timestamp', 'requestId', 'method', 'scope', 'status', 'errorType', 'databaseCode'].includes(key)), []);
  } finally { console.warn = original; }
});
