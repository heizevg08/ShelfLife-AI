const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createIngredients } = require('../dist/services/ingredients');
const { ingredientInput, ingredientPagination } = require('../dist/validators/ingredient');
const { versionConflict } = require('../dist/validators/inventory-contract');

const admin = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Admin User', email: 'admin@shelflife.com', role: 'Admin', isActive: true, authVersion: 0 };
const manager = { id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Manager User', email: 'manager@shelflife.com', role: 'Inventory Manager', isActive: true, authVersion: 0 };

test('ingredient validation preserves the ingredient/batch boundary and numeric rules', () => {
  const valid = ingredientInput({ name: '  Whole   Milk ', brand: '', description: '', category: 'Dairy', unitOfMeasure: ' L ', minimumStock: 0, standardUnitCost: 0, defaultShelfLifeDays: 7 });
  assert.equal(valid.name, 'Whole Milk');
  assert.equal(valid.unitOfMeasure, 'L');
  for (const body of [
    { ...valid, expirationDate: '2030-01-01' },
    { ...valid, name: '' },
    { ...valid, minimumStock: -1 },
    { ...valid, defaultShelfLifeDays: 0 },
    { ...valid, defaultShelfLifeDays: 1.5 },
    { ...valid, category: 'Unknown' },
    { ...valid, isActive: false },
  ]) assert.throws(() => ingredientInput(body));
  assert.deepEqual(ingredientPagination({ page: '2', limit: '10', search: 'milk', category: 'Dairy' }), { page: 2, limit: 10, search: 'milk', category: 'Dairy', includeArchived: false });
  assert.equal(ingredientPagination({ includeArchived: 'true' }).includeArchived, true);
  assert.equal(ingredientPagination({ includeArchived: 'false' }).includeArchived, false);
  for (const includeArchived of ['yes', ['true'], { $ne: false }]) assert.throws(() => ingredientPagination({ includeArchived }));
});

test('ingredient HTTP API authenticates, enforces per-method roles, validates, pages, and returns real writes', async () => {
  const rows = [];
  const store = {
    async list(query) {
      const found = rows.filter(row => (query.includeArchived || row.isActive !== false) && (!query.category || row.category === query.category) && (!query.search || `${row.name} ${row.brand}`.toLowerCase().includes(query.search.toLowerCase())));
      return { items: found.slice((query.page - 1) * query.limit, query.page * query.limit), page: query.page, limit: query.limit, total: found.length };
    },
    async create(actorId, input) {
      if (rows.some(row => row.name.toLowerCase() === input.name.toLowerCase())) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const now = new Date().toISOString();
      const row = { id: String(rows.length + 3).repeat(24).slice(0, 24), ...input, version: 0, isActive: true, createdBy: { id: actorId, name: admin.name }, createdAt: now, updatedAt: now };
      rows.push(row); return row;
    },
    async update(actorId, id, input, expectedVersion) { const index = rows.findIndex(row => row.id === id); if (index < 0) return null; if(rows[index].version !== expectedVersion) throw versionConflict(); if(!rows[index].isActive) return null; rows[index] = { ...rows[index], ...input, version: expectedVersion + 1, updatedAt: new Date().toISOString() }; return rows[index]; },
    async remove(actorId, id, expectedVersion) { const row = rows.find(row => row.id === id); if (!row) return false; if(row.version !== expectedVersion) throw versionConflict(); if(!row.isActive) return false; row.isActive = false; row.version++; return true; },
  };
  const staff = { ...admin, id: '4'.repeat(24), _id: '4'.repeat(24), role: 'Inventory Staff' };
  const superAdmin = { ...admin, id: '5'.repeat(24), _id: '5'.repeat(24), role: 'Super Admin' };
  const users = [admin, manager, staff, superAdmin];
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, createIngredients(store));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/ingredients`;
  const token = user => auth.issue(user).accessToken;
  const request = (user, method = 'GET', body, query = '') => fetch(base + query, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const input = { name: 'Whole Milk', brand: 'Local', description: '', category: 'Dairy', unitOfMeasure: 'L', minimumStock: 4, standardUnitCost: 82.5, defaultShelfLifeDays: 7 };
  try {
    assert.equal((await request(undefined)).status, 401);
    for (const role of users) assert.equal((await request(role)).status, 200);
    for (const role of [admin, superAdmin]) {
      assert.equal((await request(role, 'POST', input)).status, 403);
      assert.equal((await request(role, 'PATCH', input, '/' + '3'.repeat(24))).status, 403);
      assert.equal((await request(role, 'DELETE', undefined, '/' + '3'.repeat(24))).status, 403);
    }
    assert.equal((await request(staff, 'POST', { ...input, name: 'Staff creation' })).status, 201);
    assert.equal((await request(staff, 'PATCH', input, '/' + rows[0].id)).status, 403);
    assert.equal((await request(staff, 'DELETE', undefined, '/' + rows[0].id)).status, 403);
    assert.equal(rows[0].name, 'Staff creation');
    rows.length = 0;
    assert.equal((await request(manager, 'POST', { ...input, expirationDate: '2030-01-01' })).status, 400);
    const created = await request(manager, 'POST', input); assert.equal(created.status, 201);
    const body = await created.json(); assert.equal(body.ingredient.name, 'Whole Milk'); assert.equal(body.ingredient.createdBy.id, manager.id);
    const listed = await (await request(manager, 'GET', undefined, '?page=1&limit=10&search=milk&category=Dairy')).json();
    assert.equal(listed.total, 1); assert.equal(listed.items[0].id, body.ingredient.id);
    const duplicate = await request(manager, 'POST', input); assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).error.code, 'CONFLICT');
    const id = body.ingredient.id;
    const updated = await request(manager, 'PATCH', { brand: 'Updated Brand', expectedVersion: 0 }, `/${id}`); assert.equal(updated.status, 200); assert.equal((await updated.json()).ingredient.brand, 'Updated Brand');
    assert.equal((await request(manager, 'PATCH', { brand: 'stale', expectedVersion: 0 }, `/${id}`)).status, 409);
    assert.equal((await request(manager, 'PATCH', { brand: 'missing version' }, `/${id}`)).status, 400);
    assert.equal((await request(manager, 'DELETE', { expectedVersion: 1 }, `/${id}`)).status, 204);
    assert.equal((await request(manager, 'DELETE', { expectedVersion: 2 }, `/${id}`)).status, 404);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].isActive, false);
    assert.equal((await (await request(manager)).json()).total, 0);
    assert.equal((await (await request(manager, 'GET', undefined, '?includeArchived=true')).json()).items[0].isActive, false);
    assert.equal((await request(manager, 'PATCH', { ...input, expectedVersion: 2 }, `/${id}`)).status, 404);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
