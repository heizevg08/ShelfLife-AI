const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createIngredients } = require('../dist/services/ingredients');
const { ingredientInput, ingredientPagination } = require('../dist/validators/ingredient');

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
  ]) assert.throws(() => ingredientInput(body));
  assert.deepEqual(ingredientPagination({ page: '2', pageSize: '10', search: 'milk', category: 'Dairy' }), { page: 2, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc', search: 'milk', category: 'Dairy' });
});

test('ingredient HTTP API authenticates, authorizes Admin, validates, pages, and returns real writes', async () => {
  const rows = [];
  const store = {
    async list(query) {
      const found = rows.filter(row => (!query.category || row.category === query.category) && (!query.search || `${row.name} ${row.brand}`.toLowerCase().includes(query.search.toLowerCase())));
      return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total: found.length };
    },
    async create(actorId, input) {
      if (rows.some(row => row.name.toLowerCase() === input.name.toLowerCase())) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const now = new Date().toISOString();
      const row = { id: String(rows.length + 3).repeat(24).slice(0, 24), ...input, createdBy: { id: actorId, name: admin.name }, createdAt: now, updatedAt: now };
      rows.push(row); return row;
    },
    async update(actorId, id, input) { const index = rows.findIndex(row => row.id === id); if (index < 0) return null; rows[index] = { ...rows[index], ...input, updatedAt: new Date().toISOString() }; return rows[index]; },
    async remove(actorId, id) { const index = rows.findIndex(row => row.id === id); if (index < 0) return false; rows.splice(index, 1); return true; },
  };
  const users = [admin, manager];
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, createIngredients(store));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/ingredients`;
  const token = user => auth.issue(user).accessToken;
  const request = (user, method = 'GET', body, query = '') => fetch(base + query, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const input = { name: 'Whole Milk', brand: 'Local', description: '', category: 'Dairy', unitOfMeasure: 'L', minimumStock: 4, standardUnitCost: 82.5, defaultShelfLifeDays: 7 };
  try {
    assert.equal((await request(undefined)).status, 401);
    assert.equal((await request(manager)).status, 403);
    assert.equal((await request(admin, 'POST', { ...input, expirationDate: '2030-01-01' })).status, 400);
    const created = await request(admin, 'POST', input); assert.equal(created.status, 201);
    const body = await created.json(); assert.equal(body.ingredient.name, 'Whole Milk'); assert.equal(body.ingredient.createdBy.id, admin.id);
    const listed = await (await request(admin, 'GET', undefined, '?page=1&pageSize=10&search=milk&category=Dairy')).json();
    assert.equal(listed.total, 1); assert.equal(listed.items[0].id, body.ingredient.id);
    const duplicate = await request(admin, 'POST', input); assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).error.code, 'CONFLICT');
    const id = body.ingredient.id;
    const updated = await request(admin, 'PUT', { ...input, brand: 'Updated Brand' }, `/${id}`); assert.equal(updated.status, 200); assert.equal((await updated.json()).ingredient.brand, 'Updated Brand');
    assert.equal((await request(admin, 'DELETE', undefined, `/${id}`)).status, 204);
    assert.equal((await request(admin, 'DELETE', undefined, `/${id}`)).status, 404);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
