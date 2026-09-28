const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createWasteRecords } = require('../dist/services/waste-records');
const { wasteInput, wastePagination } = require('../dist/validators/waste-record');

const staff = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Staff', email: 'staff@shelflife.com', role: 'Inventory Staff', isActive: true, authVersion: 0 };
const admin = { ...staff, id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Admin', email: 'admin@shelflife.com', role: 'Admin' };
const record = { id: '3'.repeat(24), dateWasted: '2030-01-10T00:00:00.000Z', ingredient: { id: '4'.repeat(24), name: 'Milk' }, batch: { id: '5'.repeat(24), batchID: 'SL-20300110-001' }, quantityWasted: 2, unit: 'L', reason: 'Spoiled', wasteCost: 24, recordedBy: { id: staff.id, name: staff.name }, createdAt: '2030-01-10T01:00:00.000Z' };

test('Waste input accepts only client-owned fields and canonical reasons', () => {
  assert.deepEqual(wasteInput({ ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 2, reason: 'Spoiled' }), { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: new Date('2030-01-10T00:00:00.000Z'), quantityWasted: 2, reason: 'Spoiled' });
  for (const body of [
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 0, reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: -1, reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 'dddd', reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: Number.NaN, reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: Infinity, reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-02-31', quantityWasted: 1, reason: 'Spoiled' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 1, reason: 'Unknown' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 1, reason: 'Spoiled', unit: 'L' },
    { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 1, reason: 'Spoiled', wasteCost: 24 },
  ]) assert.throws(() => wasteInput(body));
  assert.deepEqual(wastePagination({ page: '2', pageSize: '15', reason: 'Spoiled', ingredientId: record.ingredient.id, from: '2030-01-01', to: '2030-01-31' }), { page: 2, pageSize: 15, reason: 'Spoiled', ingredientId: record.ingredient.id, from: new Date('2030-01-01T00:00:00.000Z'), to: new Date('2030-01-31T23:59:59.999Z') });
});

test('Waste API restricts mutation to Inventory Staff and preserves list, summary, and count-breakdown contracts', async () => {
  let received;
  const store = {
    async ready() {},
    async list(query) { received = query; return { items: query.search === 'none' ? [] : [record], page: query.page, pageSize: query.pageSize, total: query.search === 'none' ? 0 : 1 }; },
    async detail(id) { return id === record.id ? record : null; },
    async summary() { return { totalWasteToday: { quantity: 2, unit: 'L' }, wasteRecordsToday: 1, mostWastedIngredient: 'Milk', commonWasteReason: 'Spoiled', totalWasteCostToday: 24 }; },
    async reasonBreakdown() { return { period: 'Last 30 Days', counts: { Expired: 0, Spoiled: 1, Damaged: 0, 'Over-prepared': 0, Other: 0 }, total: 1 }; },
    async create(actor, input) { return { ...record, quantityWasted: input.quantityWasted, dateWasted: input.dateWasted.toISOString(), reason: input.reason, recordedBy: { id: actor.id, name: actor.name } }; },
  };
  const auth = createAuth({ byId: async id => [staff, admin].find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, createWasteRecords(store, () => new Date('2030-01-10T12:00:00.000Z')));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/waste-records`;
  const request = (user, path = '', method = 'GET', body) => fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${auth.issue(user).accessToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request(admin, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 2, reason: 'Spoiled' })).status, 403);
    assert.equal((await request(staff, '?page=2&pageSize=15&reason=Spoiled&ingredientId=' + record.ingredient.id + '&from=2030-01-01&to=2030-01-31')).status, 200);
    assert.equal(received.page, 2); assert.equal(received.pageSize, 15); assert.equal(received.reason, 'Spoiled');
    assert.equal((await request(staff, '/summary')).status, 200);
    assert.equal((await request(staff, '/reason-breakdown')).status, 200);
    const created = await request(staff, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 2, reason: 'Spoiled' });
    assert.equal(created.status, 201); assert.equal((await created.json()).record.unit, 'L');
    assert.equal((await request(staff, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-10', quantityWasted: 1, reason: 'Spoiled', recordedBy: admin.id })).status, 400);
    const futureWaste = await request(staff, '', 'POST', { ingredientId: record.ingredient.id, batchId: record.batch.id, dateWasted: '2030-01-11', quantityWasted: 1, reason: 'Spoiled' });
    assert.equal(futureWaste.status, 400);
    assert.deepEqual((await futureWaste.json()).error.details, [{ field: 'dateWasted', message: 'Date wasted cannot be in the future' }]);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
