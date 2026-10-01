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
const manager = { id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Manager User', email: 'manager@shelflife.com', role: 'Manager', isActive: true, authVersion: 0 };
const staff = { id: '3'.repeat(24), _id: '3'.repeat(24), name: 'Inventory Staff User', email: 'staff@shelflife.com', role: 'Inventory Staff', isActive: true, authVersion: 0 };

test('ingredient validation preserves the ingredient/batch boundary and numeric rules', () => {
  const valid = ingredientInput({ name: '  Whole   Milk ', brand: '', description: '', category: 'Dairy', unitOfMeasure: ' liter ', minimumStock: 0, standardUnitCost: 0, defaultShelfLifeDays: 7 });
  assert.equal(valid.name, 'Whole Milk');
  assert.equal(valid.unitOfMeasure, 'liter');
  for (const body of [
    { ...valid, expirationDate: '2030-01-01' },
    { ...valid, name: '' },
    { ...valid, minimumStock: -1 },
    { ...valid, minimumStock: 1_000_000_001 },
    { ...valid, standardUnitCost: Number.POSITIVE_INFINITY },
    { ...valid, standardUnitCost: 12.345 },
    { ...valid, defaultShelfLifeDays: 0 },
    { ...valid, defaultShelfLifeDays: 1.5 },
    { ...valid, defaultShelfLifeDays: 3651 },
    { ...valid, category: 'Unknown' },
  ]) assert.throws(() => ingredientInput(body));
  assert.deepEqual(ingredientPagination({ page: '2', pageSize: '10', search: 'milk', category: 'Dairy' }), { page: 2, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc', search: 'milk', category: 'Dairy', unit: '' });
});

test('ingredient HTTP API authenticates, authorizes Admin, validates, pages, and returns real writes', async () => {
  const rows = [];
  const store = {
    async stockInOptions() { return rows.map(row => ({ id: row.id, name: row.name, unitOfMeasure: row.unitOfMeasure, ...(row.standardUnitCost === undefined ? {} : { standardUnitCost: row.standardUnitCost }), ...(row.defaultShelfLifeDays === undefined ? {} : { defaultShelfLifeDays: row.defaultShelfLifeDays }) })); },
    async summary() {
      return { total: rows.length, categories: [...new Set(rows.map(row => row.category))], units: [...new Set(rows.map(row => row.unitOfMeasure))], mostCommonIngredient: null };
    },
    async list(query) {
      const found = rows.filter(row => (!query.category || row.category === query.category) && (!query.unit || row.unitOfMeasure === query.unit) && (!query.search || `${row.name} ${row.brand}`.toLowerCase().includes(query.search.toLowerCase())));
      return { items: found.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total: found.length };
    },
    async create(actor, input) {
      if (rows.some(row => row.name.toLowerCase() === input.name.toLowerCase())) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const now = new Date().toISOString();
      const row = { id: String(rows.length + 3).repeat(24).slice(0, 24), ...input, createdBy: { id: actor.id, name: admin.name }, createdAt: now, updatedAt: now };
      rows.push(row); return row;
    },
    async update(_actor, id, input) { const index = rows.findIndex(row => row.id === id); if (index < 0) return null; rows[index] = { ...rows[index], ...input, updatedAt: new Date().toISOString() }; return rows[index]; },
    async remove(_actor, id) { const index = rows.findIndex(row => row.id === id); if (index < 0) return false; rows.splice(index, 1); return true; },
  };
  const users = [admin, manager, staff];
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, createIngredients(store));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/ingredients`;
  const token = user => auth.issue(user).accessToken;
  const request = (user, method = 'GET', body, query = '') => fetch(base + query, { method, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const input = { name: 'Whole Milk', brand: 'Local', description: '', category: 'Dairy', unitOfMeasure: 'liter', minimumStock: 4, standardUnitCost: 82.5, defaultShelfLifeDays: 7 };
  try {
    assert.equal((await request(undefined)).status, 401);
    assert.equal((await request(manager)).status, 200);
    const categories = await request(staff, 'GET', undefined, '/categories');
    assert.equal(categories.status, 200);
    assert.deepEqual((await categories.json()).categories, ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other']);
    const options = await request(staff, 'GET', undefined, '/stock-in-options');
    assert.equal(options.status, 200); assert.deepEqual((await options.json()).ingredients, []);
    assert.equal((await request(manager, 'GET', undefined, '/stock-in-options')).status, 200);
    const summary = await request(admin, 'GET', undefined, '/summary');
    assert.equal(summary.status, 200);
    assert.deepEqual(await summary.json(), { total: 0, categories: [], units: [], mostCommonIngredient: null });
    assert.equal((await request(admin, 'POST', { ...input, expirationDate: '2030-01-01' })).status, 400);
    const created = await request(admin, 'POST', input); assert.equal(created.status, 201);
    const body = await created.json(); assert.equal(body.ingredient.name, 'Whole Milk'); assert.equal(body.ingredient.createdBy.id, admin.id);
    const populatedOptions = await request(staff, 'GET', undefined, '/stock-in-options');
    assert.equal(populatedOptions.status, 200);
    assert.deepEqual((await populatedOptions.json()).ingredients, [{ id: body.ingredient.id, name: 'Whole Milk', unitOfMeasure: 'liter', standardUnitCost: 82.5, defaultShelfLifeDays: 7 }]);
    const listed = await (await request(admin, 'GET', undefined, '?page=1&pageSize=10&search=milk&category=Dairy&unit=liter')).json();
    assert.equal(listed.total, 1); assert.equal(listed.items[0].id, body.ingredient.id);
    const duplicate = await request(admin, 'POST', input); assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).error.code, 'CONFLICT');
    const managerCreated = await request(manager, 'POST', { ...input, name: 'Manager Ingredient' }); assert.equal(managerCreated.status, 201);
    assert.equal((await request(manager, 'PUT', { ...input, brand: 'Denied' }, `/${body.ingredient.id}`)).status, 403);
    assert.equal((await request(manager, 'DELETE', undefined, `/${body.ingredient.id}`)).status, 403);
    const id = body.ingredient.id;
    const updated = await request(admin, 'PUT', { ...input, brand: 'Updated Brand' }, `/${id}`); assert.equal(updated.status, 200); assert.equal((await updated.json()).ingredient.brand, 'Updated Brand');
    assert.equal((await request(admin, 'DELETE', undefined, `/${id}`)).status, 204);
    assert.equal((await request(admin, 'DELETE', undefined, `/${id}`)).status, 404);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
