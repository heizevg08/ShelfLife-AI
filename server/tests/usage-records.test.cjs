const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createUsageRecords } = require('../dist/services/usage-records');
const { usageBulkInput, usageInput, usagePagination } = require('../dist/validators/usage-record');

const staff = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Staff', email: 'staff@shelflife.com', role: 'Inventory Staff', isActive: true, authVersion: 0 };
const admin = { ...staff, id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Admin', email: 'admin@shelflife.com', role: 'Admin' };
const manager = { ...staff, id: '6'.repeat(24), _id: '6'.repeat(24), name: 'Manager', email: 'manager@shelflife.com', role: 'Manager' };
const record = { id: '3'.repeat(24), dateUsed: '2030-01-10T00:00:00.000Z', ingredient: { id: '4'.repeat(24), name: 'Milk' }, batch: { id: '5'.repeat(24), batchID: 'SL-20300110-001' }, quantityUsed: 2, unit: 'L', recordedBy: { id: staff.id, name: staff.name }, createdAt: '2030-01-10T01:00:00.000Z' };

test('Usage input accepts only staff-controlled fields and positive quantities', () => {
  assert.deepEqual(usageInput({ ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 2 }), { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: new Date('2030-01-10T00:00:00.000Z'), quantityUsed: 2 });
  for (const body of [{ ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 0 }, { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: -1 }, { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-02-31', quantityUsed: 1 }, { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 1, unit: 'kg' }]) assert.throws(() => usageInput(body));
  assert.deepEqual(usagePagination({ page: '2', pageSize: '15', ingredientId: record.ingredient.id, from: '2030-01-01', to: '2030-01-31' }), { page: 2, pageSize: 15, ingredientId: record.ingredient.id, from: new Date('2030-01-01T00:00:00.000Z'), to: new Date('2030-01-31T23:59:59.999Z') });
});

test('Usage bulk input validates a strict bounded items contract', () => {
  const item = { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 1 };
  assert.equal(usageBulkInput({ items: [item, item] }).length, 2);
  assert.throws(() => usageBulkInput({ items: [] }));
  assert.throws(() => usageBulkInput({ items: [item], unit: 'L' }));
});

test('Usage API permits authorized Manager and Inventory Staff operations and preserves query contracts', async () => {
  let received;
  const store = {
    async ready() {},
    async list(query) { received = query; return { items: query.search === 'none' ? [] : [record], page: query.page, pageSize: query.pageSize, total: query.search === 'none' ? 0 : 1 }; },
    async detail(id) { return id === record.id ? record : null; },
    async summary() { return { totalUsageToday: { quantity: 2, unit: 'L' }, usageRecordsToday: 1, mostUsedIngredient: null, ingredientsUsedThisWeek: 1 }; },
    async create(actor, input) { return { ...record, quantityUsed: input.quantityUsed, dateUsed: input.dateUsed.toISOString(), recordedBy: { id: actor.id, name: actor.name } }; },
    async createMany(actor, inputs) { return Promise.all(inputs.map(input => this.create(actor, input))); },
  };
  const auth = createAuth({ byId: async id => [staff, admin, manager].find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, undefined, undefined, createUsageRecords(store, () => new Date('2030-01-10T12:00:00.000Z')));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/usage-records`;
  const request = (user, path = '', method = 'GET', body) => fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${auth.issue(user).accessToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request(admin)).status, 403);
    assert.equal((await request(manager)).status, 200);
    assert.equal((await request(staff, '?page=2&pageSize=15&ingredientId=' + record.ingredient.id + '&from=2030-01-01&to=2030-01-31')).status, 200);
    assert.equal(received.page, 2); assert.equal(received.pageSize, 15); assert.equal(received.ingredientId, record.ingredient.id);
    assert.equal((await request(staff, '?search=none')).status, 200);
    assert.equal((await request(staff, '/summary')).status, 200);
    assert.equal((await request(staff, '/' + record.id)).status, 200);
    assert.equal((await request(staff, '/' + '9'.repeat(24))).status, 404);
    const created = await request(staff, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 2 });
    assert.equal(created.status, 201); assert.equal((await created.json()).record.unit, 'L');
    const bulk = await request(staff, '/bulk', 'POST', { items: [{ ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 1 }, { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 2 }] }); assert.equal(bulk.status, 201); assert.equal((await bulk.json()).count, 2);
    assert.equal((await request(manager, '/bulk', 'POST', { items: [{ ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 1 }] })).status, 403);
    assert.equal((await request(manager, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 2 })).status, 201);
    assert.equal((await request(staff, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateUsed: '2030-01-10', quantityUsed: 0 })).status, 400);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
