const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { batchInput, batchPatch, batchCorrection, batchPagination } = require('../dist/validators/inventory-batch');
const { batchStatus, manilaDate } = require('../dist/services/batch-status');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { decimal, decimalUnits, calendarDate } = require('../dist/validators/inventory-contract');
const { createInventoryBatches } = require('../dist/services/inventory-batches');

const input = { ingredientId: '1'.repeat(24), batchCode: 'B-001', initialQuantity: '10.5', unit: 'kg', unitCost: '123.4567', dateReceived: '2026-09-20', expirationDate: '2026-09-30' };
test('batch inputs use exact decimal strings, controlled units, immutable identity and allowlisted PATCH', () => {
  assert.equal(batchInput(input).initialQuantity, '10.500');
  assert.equal(batchInput(input).batchCode, 'B-001');
  assert.throws(() => batchInput({ ...input, batchCode: ' B-001 ' }));
  assert.equal(decimal('999999999999999999.999', 3, 'quantity'), '999999999999999999.999');
  assert.equal(decimalUnits('999999999999999999.999'), 999999999999999999999n);
  for (const value of [1, '1e3', 'NaN', 'Infinity', '-0.001', '1.0001', '1000000000000000000', ' 1.0 ', { $gt: 0 }]) assert.throws(() => batchInput({ ...input, initialQuantity: value }));
  for (const patch of [{ quantity: '1.000' }, { initialQuantity: '12.000' }, { status: 'Normal' }, { version: 3 }, { isActive: false }, { ingredientId: '2'.repeat(24) }, { batchCode: 'new' }, { currency: 'USD' }]) {
    assert.throws(() => batchPatch({ expectedVersion: 0, ...patch }));
  }
  assert.deepEqual(batchPatch({ expectedVersion: 2, unitCost: '0.1' }), { expectedVersion: 2, patch: { unitCost: '0.1000' } });
  for (const patch of [{ unit: 'liter' }, { unitCost: '1.23456' }, { expirationDate: '2026-02-30' }, { dateReceived: '2026-09-30' }, { initialQuantity: '0' }, { quantity: '2.000' }]) assert.throws(() => batchInput({ ...input, ...patch }));
  assert.throws(() => batchPatch({ unitCost: '2' }));
  assert.throws(() => batchCorrection({ expectedVersion: 0, correctedQuantity: '1', reason: 'Counted again' }));
  assert.throws(() => batchCorrection({ expectedVersion: 0, correctedQuantity: '1', approved: true, reason: '' }));
  assert.deepEqual(batchCorrection({ expectedVersion: 0, correctedQuantity: '0', approved: true, reason: ' Counted again ' }), { expectedVersion: 0, correctedQuantity: '0.000', reason: 'Counted again' });
  assert.deepEqual(batchPagination({}), { page: 1, limit: 25, includeArchived: false });
  for (const query of [{ pageSize: '25' }, { limit: '101' }, { ingredientId: { $ne: null } }, { includeArchived: ['true'] }]) assert.throws(() => batchPagination(query));
});

test('status derives from Manila calendar days on every read, with exact threshold boundaries', () => {
  const config = { criticalDays: 2, approachingDays: 7 };
  const beforeMidnight = new Date('2026-09-21T15:59:59.999Z'), midnight = new Date('2026-09-21T16:00:00.000Z');
  assert.equal(manilaDate(beforeMidnight), '2026-09-21'); assert.equal(manilaDate(midnight), '2026-09-22');
  for (const [expiration, expected] of [['2026-09-20', 'Expired'], ['2026-09-21', 'Critical'], ['2026-09-23', 'Critical'], ['2026-09-24', 'Approaching Expiry'], ['2026-09-28', 'Approaching Expiry'], ['2026-09-29', 'Normal']]) assert.equal(batchStatus(expiration, config, beforeMidnight), expected);
  assert.equal(batchStatus('2026-09-21', config, midnight), 'Expired');
  assert.equal(batchStatus('2026-09-25', { criticalDays: 5, approachingDays: 10 }, midnight), 'Critical');
  assert.equal(calendarDate('2028-02-29', 'date'), '2028-02-29');
  for (const date of ['2026-02-29', '0000-01-01', '2026-09-21T00:00:00Z']) assert.throws(() => calendarDate(date, 'date'));
});

test('batch schema enforces collection, controlled units, decimal bounds and no persisted status', async () => {
  const driver = new Mongoose(), Model = inventoryBatchModel(driver);
  assert.equal(Model.collection.name, 'inventoryBatches');
  const good = { ...batchInput(input), quantity: '10.500', createdBy: '2'.repeat(24) };
  const row = new Model(good); await row.validate();
  assert.equal(row.initialQuantity._bsontype, 'Decimal128'); assert.equal(row.unitCost._bsontype, 'Decimal128');
  assert.equal(row.currency, 'PHP'); assert.equal(row.version, 0);
  for (const patch of [{ unit: 'liter' }, { quantity: '10.501' }, { initialQuantity: '0', quantity: '0' }, { unitCost: '-1' }, { unitCost: '1.23456' }, { expirationDate: '2026-02-30' }, { expirationDate: '2026-09-19' }, { currency: 'USD' }]) await assert.rejects(new Model({ ...good, ...patch }).validate());
  assert.throws(() => new Model({ ...good, status: 'Normal' }));
});

test('a duplicate batch code reports the batch conflict rather than an ingredient conflict', async t => {
  const manager = { id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Manager', email: 'manager@shelflife.com', role: 'Inventory Manager', isActive: true, authVersion: 0 };
  const auth = createAuth({ byId: async id => id === manager.id ? manager : null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: { ingredientId: 1, batchCode: 1 }, index: 'ingredient_batch_code_unique' });
  const batches = { create: async () => { throw duplicate; } };
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, undefined, batches));
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/inventory-batches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.issue(manager).accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.message, 'A batch with this code already exists for this ingredient, including archived batches');
});

test('inventory batch summary is manager-only', async t => {
  const roles = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
  const users = roles.map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), name: role, email: `${index}@shelflife.com`, role, isActive: true, authVersion: 0 }));
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, undefined, { summary: async () => ({ totalIngredients: 0, totalBatches: 0, lowStockItems: 0, lowStockExcludedCount: 0, statusCounts: { Normal: 0, 'Approaching Expiry': 0, Critical: 0, Expired: 0 }, categoryCounts: [], inventoryValue: '0.00' }) }));
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = user => fetch(`http://127.0.0.1:${server.address().port}/api/inventory-batches/summary`, { headers: user ? { Authorization: `Bearer ${auth.issue(user).accessToken}` } : {} });
  assert.equal((await call()).status, 401);
  assert.equal((await call(users[2])).status, 200);
  for (const user of [users[0], users[1], users[3]]) assert.equal((await call(user)).status, 403);
});

test('inventory batch summary uses active positive on-hand quantities and rounds PHP totals only once', async () => {
  const id = value => ({ toString: () => value.padEnd(24, value[0]) });
  const decimalValue = value => ({ toString: () => value });
  const active = id('1'), second = id('2'), threeDecimals = id('3'), zero = id('4'), tooPrecise = id('5'), binaryFraction = id('6'), exponent = id('7'), invalid = id('8'), infinite = id('9'), negative = id('a');
  const ingredients = [
    { _id: active, category: 'Dairy', minimumStock: 0.1 },
    { _id: second, category: 'Pantry', minimumStock: 2.5 },
    { _id: threeDecimals, category: 'Produce', minimumStock: 1.005 },
    { _id: zero, category: 'Beverages', minimumStock: 0 },
    { _id: tooPrecise, category: 'Frozen', minimumStock: 1.0005 },
    { _id: binaryFraction, category: 'Bakery', minimumStock: 0.1 + 0.2 },
    { _id: exponent, category: 'Seafood', minimumStock: 1e-7 },
    { _id: invalid, category: 'Other', minimumStock: Number.NaN },
    { _id: infinite, category: 'Other', minimumStock: Number.POSITIVE_INFINITY },
    { _id: negative, category: 'Meat', minimumStock: -1 },
  ];
  const row = (ingredientId, code, quantity, unitCost, expirationDate) => ({ _id: id(code), ingredientId, batchCode: code, initialQuantity: decimalValue(quantity), quantity: decimalValue(quantity), unit: 'kg', unitCost: decimalValue(unitCost), currency: 'PHP', dateReceived: '2026-09-20', expirationDate, isActive: true, version: 0, createdBy: id('9'), createdAt: new Date(), updatedAt: new Date() });
  const batches = [row(active, 'a', '1.000', '0.0049', '2026-09-23'), row(active, 'b', '1.000', '0.0049', '2026-09-24'), row(second, 'c', '0.000', '1.0000', '2026-09-20')];
  const query = rows => ({ lean: () => ({ exec: async () => rows }) });
  const service = createInventoryBatches({}, { find: () => query(batches) }, { find: () => ({ select: () => query(ingredients) }) }, {}, { get: async () => ({ criticalDays: 2, approachingDays: 7, lowStockMultiplier: '1.000', version: 0 }) }, () => new Date('2026-09-21T15:59:59.999Z'));
  const summary = await service.summary();
  assert.equal(summary.inventoryValue, '0.01');
  assert.equal(summary.categoryCounts.find(item => item.category === 'Dairy').inventoryValue, '0.01');
  assert.equal(summary.lowStockItems, 3);
  assert.equal(summary.lowStockExcludedCount, 6);
  assert.deepEqual(summary.statusCounts, { Normal: 0, 'Approaching Expiry': 1, Critical: 1, Expired: 1 });
});
