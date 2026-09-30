const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { usageRecordModel, wasteRecordModel } = require('../dist/models/inventory-record');
const { recordCreateInput, recordCorrectionInput, recordPagination } = require('../dist/validators/inventory-record');
const { recordTotalCost } = require('../dist/services/inventory-records');

const ids = { ingredientId: '1'.repeat(24), batchId: '2'.repeat(24) };
test('record validators enforce exact quantity, Manila calendar dates, filters, and Other notes', async () => {
  assert.deepEqual(recordCreateInput('UsageRecord', { ...ids, quantity: '1.2', recordedAt: '2026-09-30', notes: ' prep ' }), { ...ids, quantity: '1.200', recordedAt: '2026-09-30', notes: 'prep' });
  assert.deepEqual(recordCreateInput('WasteRecord', { ...ids, quantity: '1', recordedAt: '2026-09-30', reason: 'Other', notes: 'Spoiled seal' }).quantity, '1.000');
  for (const body of [{ ...ids, quantity: '0', recordedAt: '2026-09-30' }, { ...ids, quantity: '-1', recordedAt: '2026-09-30' }, { ...ids, quantity: '1.0001', recordedAt: '2026-09-30' }, { ...ids, quantity: '1', recordedAt: '2026-02-30' }, { ...ids, quantity: '1', recordedAt: '2026-09-30', injected: true }]) assert.throws(() => recordCreateInput('UsageRecord', body));
  assert.throws(() => recordCreateInput('WasteRecord', { ...ids, quantity: '1', recordedAt: '2026-09-30', reason: 'Other', notes: ' ' }));
  assert.throws(() => recordCreateInput('WasteRecord', { ...ids, quantity: '1', recordedAt: '2026-09-30', reason: 'Unknown' }));
  assert.deepEqual(recordCorrectionInput({ expectedVersion: 2, correctedQuantity: '2.4', reason: 'Recounted' }), { expectedVersion: 2, correctedQuantity: '2.400', reason: 'Recounted' });
  assert.equal(recordTotalCost('1.250', '4.1234'), '5.15');
  assert.equal(recordTotalCost('1.000', '1.0050'), '1.01'); // final-step half-up
  assert.deepEqual(recordPagination({ ingredientId: ids.ingredientId, from: '2026-09-01', to: '2026-09-30' }), { page: 1, limit: 25, includeArchived: false, ingredientId: ids.ingredientId, from: '2026-09-01', to: '2026-09-30' });
});

test('usage and waste schemas use explicit collections, Decimal128 snapshots and correction provenance', async () => {
  const driver = new Mongoose();
  for (const [kind, factory, collection] of [['UsageRecord', usageRecordModel, 'usageRecords'], ['WasteRecord', wasteRecordModel, 'wasteRecords']]) {
    const Model = factory(driver); assert.equal(Model.collection.name, collection);
    const record = new Model({ ...ids, quantity: '1.250', unit: 'kg', unitCostSnapshot: '4.1234', totalCostSnapshot: '5.15', recordedBy: '3'.repeat(24), recordedAt: '2026-09-30', ...(kind === 'WasteRecord' ? { reason: 'Other', notes: 'Dropped' } : {}) });
    await record.validate(); assert.equal(record.quantity._bsontype, 'Decimal128'); assert.equal(record.type, 'original');
    await assert.rejects(new Model({ ...record.toObject(), ...(kind === 'WasteRecord' ? { reason: 'Other', notes: '' } : {}), type: 'correction', correctionOf: null }).validate());
  }
});

test('record routes enforce create and read roles while preserving staff create-only access', async t => {
  const roles = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
  const users = roles.map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), name: role, email: `${index}@shelflife.com`, role, isActive: true, authVersion: 0 }));
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) ?? null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const calls = [];
  const service = { list: async () => ({ items: [], page: 1, limit: 25, total: 0 }), get: async () => ({}), eligibleBatches: async () => [], create: async actor => { calls.push(actor.role); return { id: '4'.repeat(24) }; }, correct: async () => ({}), archive: async () => {} };
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, service, service));
  t.after(() => { server.closeAllConnections(); server.close(); }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const request = (role, method, path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { Authorization: `Bearer ${auth.issue(users[roles.indexOf(role)]).accessToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  for (const role of ['Inventory Manager', 'Inventory Staff']) assert.equal((await request(role, 'POST', '/api/usage-records', { ...ids, quantity: '1', recordedAt: '2026-09-30' })).status, 201);
  for (const role of ['Admin', 'Super Admin']) assert.equal((await request(role, 'POST', '/api/waste-records', { ...ids, quantity: '1', recordedAt: '2026-09-30', reason: 'Damaged' })).status, 403);
  assert.equal((await request('Inventory Staff', 'GET', '/api/usage-records')).status, 403);
  for (const role of ['Inventory Manager', 'Admin', 'Super Admin']) assert.equal((await request(role, 'GET', '/api/usage-records')).status, 200);
  assert.deepEqual(calls, ['Inventory Manager', 'Inventory Staff']);
});
