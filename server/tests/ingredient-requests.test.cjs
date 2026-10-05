const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createIngredientRequests } = require('../dist/services/ingredient-requests');
const { ingredientRequestReview, ingredientRequestInput, ingredientRequestPatch } = require('../dist/validators/ingredient-request');
const { createIngredients } = require('../dist/services/ingredients');

const input = { name: 'Whole Milk', brand: 'Local', description: '', category: 'Dairy', unitOfMeasure: 'L', minimumStock: 4, standardUnitCost: 82.5, defaultShelfLifeDays: 7 };
const otherInput = { ...input, category: 'Other', customCategory: 'Snacks' };

test('ingredient request validators reject approval and lifecycle mass assignment', () => {
  assert.deepEqual(ingredientRequestInput(input), input);
  assert.equal(ingredientRequestInput(otherInput).customCategory, 'Snacks');
  assert.deepEqual(ingredientRequestPatch({ name: 'Updated Milk', expectedVersion: 0 }), { input: { name: 'Updated Milk' }, expectedVersion: 0 });
  assert.throws(() => ingredientRequestPatch({ name: 'Updated@Milk', expectedVersion: 0 }));
  assert.throws(() => ingredientRequestInput({ ...input, customCategory: 'Snacks' }));
  assert.deepEqual(ingredientRequestReview({ decision: 'Approved', expectedVersion: 0 }), { decision: 'Approved', expectedVersion: 0, note: '' });
  assert.deepEqual(ingredientRequestReview({ decision: 'Rejected', expectedVersion: 2, note: 'Needs more detail' }), { decision: 'Rejected', expectedVersion: 2, note: 'Needs more detail' });
  for (const body of [{ ...input, isActive: true }, { ...input, status: 'Approved' }, { decision: 'Pending', expectedVersion: 0 }, { decision: 'Approved', expectedVersion: -1 }, { decision: 'Rejected', expectedVersion: 0, reviewedBy: '1'.repeat(24) }]) {
    assert.throws(() => body.decision ? ingredientRequestReview(body) : ingredientRequestInput(body));
  }
});

test('staff ingredient submissions remain pending until a manager or admin reviews them', async t => {
  const roles = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
  const users = roles.map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), name: role, email: `${index}@shelflife.com`, role, isActive: true }));
  const requests = [], activeIngredients = [];
  const requestStore = {
    async list(ownerId) { const items = requests.filter(row => !row.isDeleted && (!ownerId || row.createdBy.id === ownerId && row.status === 'Pending')); return { items, total: items.length }; },
    async create(ownerId, fields) {
      const row = { id: String(requests.length + 1).repeat(24), ...fields, status: 'Pending', version: 0, isDeleted: false, createdBy: { id: ownerId, name: users.find(user => user.id === ownerId).name }, reviewNote: '', ingredientId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      requests.push(row); return row;
    },
    async update(ownerId, id, fields, expectedVersion) {
      const row = requests.find(item => item.id === id && item.createdBy.id === ownerId && item.status === 'Pending' && !item.isDeleted);
      if (!row) throw Object.assign(new Error('Not found'), { status: 404 });
      if (row.version !== expectedVersion) throw Object.assign(new Error('Conflict'), { status: 409 });
      Object.assign(row, fields, { version: row.version + 1, updatedAt: new Date().toISOString() });
      return row;
    },
    async remove(reviewerId, id) {
      const row = requests.find(item => item.id === id && !item.isDeleted);
      if (!row) throw Object.assign(new Error('Not found'), { status: 404 });
      row.isDeleted = true; row.deletedBy = reviewerId;
    },
    async review(reviewerId, id, fields) {
      const row = requests.find(item => item.id === id);
      if (!row || row.status !== 'Pending' || row.isDeleted) throw Object.assign(new Error('Not found'), { status: 404 });
      if (row.version !== fields.expectedVersion) throw Object.assign(new Error('Conflict'), { status: 409 });
      row.status = fields.decision; row.reviewedBy = reviewerId; row.reviewNote = fields.note; row.version++;
      if (fields.decision === 'Approved') { row.ingredientId = String(activeIngredients.length + 5).repeat(24); activeIngredients.push({ ...row, createdBy: row.createdBy.id }); }
      return { request: row, ingredientId: row.ingredientId };
    },
  };
  const ingredientStore = {
    list: async () => ({ items: activeIngredients, page: 1, limit: 25, total: activeIngredients.length }),
    create: async () => { throw new Error('not used'); }, update: async () => null, remove: async () => false,
  };
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, createIngredients(ingredientStore), undefined, undefined, undefined, createIngredientRequests(requestStore));
  const server = createServer(app);
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (user, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${auth.issue(user).accessToken}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const staff = users[3], manager = users[2], admin = users[1];

  const submitted = await request(staff, '/ingredient-requests', 'POST', otherInput);
  assert.equal(submitted.status, 201);
  const created = (await submitted.json()).request;
  assert.equal(created.status, 'Pending');
  assert.equal((await request(staff, '/ingredients')).status, 200);
  assert.equal((await request(staff, '/ingredient-requests')).status, 200);
  assert.equal((await request(manager, '/ingredient-requests')).status, 200);
  assert.equal((await request(staff, `/ingredient-requests/${created.id}`, 'DELETE')).status, 403);
  const edited = await request(staff, `/ingredient-requests/${created.id}`, 'PATCH', { name: 'Updated Milk', expectedVersion: 0 });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).request.version, 1);
  assert.equal((await request(manager, `/ingredient-requests/${created.id}`, 'PATCH', { ...input, expectedVersion: 1 })).status, 403);
  assert.equal((await request(staff, `/ingredient-requests/${created.id}/review`, 'PATCH', { decision: 'Approved', expectedVersion: 0 })).status, 403);
  assert.equal(activeIngredients.length, 0);

  const reviewed = await request(manager, `/ingredient-requests/${created.id}/review`, 'PATCH', { decision: 'Approved', expectedVersion: 1 });
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).request.status, 'Approved');
  assert.equal(activeIngredients.length, 1);
  assert.equal(activeIngredients[0].customCategory, 'Snacks');
  assert.equal((await (await request(staff, '/ingredient-requests')).json()).total, 0);
  assert.equal((await request(manager, `/ingredient-requests/${created.id}`, 'DELETE')).status, 204);
  assert.equal((await (await request(manager, '/ingredient-requests')).json()).total, 0);
  const second = await request(staff, '/ingredient-requests', 'POST', { ...input, name: 'Second Milk' });
  const secondId = (await second.json()).request.id;
  assert.equal((await request(admin, `/ingredient-requests/${secondId}`, 'DELETE')).status, 204);
  assert.equal((await (await request(admin, '/ingredient-requests')).json()).total, 0);
});
