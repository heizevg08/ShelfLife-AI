const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createInventoryBatches } = require('../dist/services/inventory-batches');
const { deriveInventoryBatchDisplayStatus, formatInventoryBatchID, reserveInventoryBatchID } = require('../dist/services/inventory-batch-store');
const { inventoryBatchPagination, stockInInput } = require('../dist/validators/inventory-batch');

const admin = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Admin', email: 'admin@shelflife.com', role: 'Admin', isActive: true, authVersion: 0 };
const superAdmin = { ...admin, id: '2'.repeat(24), _id: '2'.repeat(24), email: 'super@shelflife.com', role: 'Super Admin' };
const manager = { ...admin, id: '3'.repeat(24), _id: '3'.repeat(24), email: 'manager@shelflife.com', role: 'Manager' };
const staff = { ...admin, id: '6'.repeat(24), _id: '6'.repeat(24), email: 'staff@shelflife.com', role: 'Inventory Staff' };

test('inventory display status preserves expiration precedence over aggregate low stock', () => {
  const now = new Date('2030-01-10T12:00:00.000Z');
  assert.equal(deriveInventoryBatchDisplayStatus(new Date('2030-01-09T12:00:00.000Z'), 2, 10, now), 'Expired');
  assert.equal(deriveInventoryBatchDisplayStatus(new Date('2030-01-17T12:00:00.000Z'), 2, 10, now), 'Near Expiry');
  assert.equal(deriveInventoryBatchDisplayStatus(new Date('2030-02-01T12:00:00.000Z'), 10, 10, now), 'Low Stock');
  assert.equal(deriveInventoryBatchDisplayStatus(new Date('2030-02-01T12:00:00.000Z'), 11, 10, now), 'In Stock');
});

test('inventory query validation accepts supported filters and rejects unsupported values', () => {
  assert.deepEqual(inventoryBatchPagination({ page: '2', pageSize: '150', search: 'milk', category: 'Dairy', status: 'Near Expiry', sort: 'fefo' }), { page: 2, pageSize: 150, search: 'milk', category: 'Dairy', status: 'Near Expiry', sort: 'fefo' });
  assert.throws(() => inventoryBatchPagination({ status: 'Critical' }));
  assert.throws(() => inventoryBatchPagination({ pageSize: '151' }));
  assert.throws(() => inventoryBatchPagination({ sortBy: 'name' }));
  assert.throws(() => inventoryBatchPagination({ sort: 'random' }));
});

test('Stock-In validation and generated Batch ID contract reject client-owned fields', () => {
  const input = stockInInput({ ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 2.5, expirationDate: '2030-01-20', unitCost: 10 });
  assert.equal(input.quantity, 2.5);
  assert.equal(formatInventoryBatchID(input.dateReceived, 1), 'SL-20300110-001');
  assert.equal(formatInventoryBatchID(input.dateReceived, 27), 'SL-20300110-027');
  for (const body of [
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 0, expirationDate: '2030-01-20' },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: -1, expirationDate: '2030-01-20' },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 1, expirationDate: '2030-01-10' },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-02-31', quantity: 1, expirationDate: '2030-03-05' },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 1, expirationDate: '2030-01-20', unitCost: -1 },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 1, expirationDate: '2030-01-20', batchID: 'client-owned' },
    { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 1, expirationDate: '2030-01-20', unit: 'kg' },
  ]) assert.throws(() => stockInInput(body));
});

test('concurrent Batch ID reservations remain unique within a receipt date', async () => {
  let sequence = 0;
  const ids = await Promise.all(Array.from({ length: 25 }, () => reserveInventoryBatchID(new Date('2030-01-10T00:00:00.000Z'), async () => ++sequence)));
  assert.equal(new Set(ids).size, 25);
  assert.equal(ids[0], 'SL-20300110-001');
  assert.equal(ids[24], 'SL-20300110-025');
});

test('inventory batch API permits authorized Manager and Inventory Staff Stock-In operations', async () => {
  const now = new Date('2030-01-10T12:00:00.000Z');
  const batch = { id: '4'.repeat(24), batchID: 'SL-20300110-001', ingredient: { id: '5'.repeat(24), name: 'Milk', category: 'Dairy', unitOfMeasure: 'L', minimumStock: 10 }, quantity: 4, unit: 'L', dateReceived: now.toISOString(), expirationDate: new Date('2030-02-01').toISOString(), displayStatus: 'Low Stock', createdBy: { id: staff.id, name: staff.name }, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  const store = {
    async list(query) { return { items: query.search === 'none' ? [] : [batch], page: query.page, pageSize: query.pageSize, total: query.search === 'none' ? 0 : 1 }; },
    async detail(id) { return id === batch.id ? batch : null; },
    async summary() { return { totalIngredients: 1, totalBatches: 1, lowStockItems: 1, nearExpiry: 0, expiredItems: 0, categories: ['Dairy'] }; },
    async stockInSummary() { return { totalBatches: 1, stockInToday: 1, ingredientsReceivedToday: 1, batchesReceivedThisMonth: 1, expiringSoonBatches: 0 }; },
    async create(actor, input) { return { ...batch, quantity: input.quantity, createdBy: { id: actor.id, name: actor.name } }; },
    async ready() {},
  };
  const users = [admin, superAdmin, manager, staff];
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, undefined, createInventoryBatches(store, () => now));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/inventory-batches`;
  const request = (user, path = '', method = 'GET', body) => fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${auth.issue(user).accessToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request(undefined)).status, 401);
    assert.equal((await request(manager)).status, 200);
    assert.equal((await request(admin, '?page=1&pageSize=10&category=Dairy&status=Low%20Stock')).status, 200);
    assert.equal((await request(superAdmin, '/summary')).status, 200);
    assert.equal((await request(staff, '/summary')).status, 200);
    assert.equal((await request(admin, `/${batch.id}`)).status, 200);
    assert.equal((await request(admin, `/${'9'.repeat(24)}`)).status, 404);
    assert.equal((await request(admin, '?status=Critical')).status, 400);
    assert.equal((await request(staff, '/stock-in-summary')).status, 200);
    const input = { ingredientId: '5'.repeat(24), dateReceived: '2030-01-10', quantity: 3, expirationDate: '2030-01-20', unitCost: 8 };
    assert.equal((await request(admin, '', 'POST', input)).status, 403);
    const managerCreated = await request(manager, '', 'POST', input); assert.equal(managerCreated.status, 201); assert.equal((await managerCreated.json()).batch.createdBy.id, manager.id);
    const created = await request(staff, '', 'POST', input); assert.equal(created.status, 201); assert.equal((await created.json()).batch.batchID, batch.batchID);
    assert.equal((await request(staff, '', 'POST', { ...input, createdBy: admin.id })).status, 400);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
