const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { batchInput, batchPatch, batchCorrection, batchPagination } = require('../dist/validators/inventory-batch');
const { batchStatus, manilaDate } = require('../dist/services/batch-status');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { decimal, decimalUnits, calendarDate } = require('../dist/validators/inventory-contract');

const input = { ingredientId: '1'.repeat(24), batchCode: ' B-001 ', initialQuantity: '10.5', unit: 'kg', unitCost: '123.4567', dateReceived: '2026-09-20', expirationDate: '2026-09-30' };
test('batch inputs use exact decimal strings, controlled units, immutable identity and allowlisted PATCH', () => {
  assert.equal(batchInput(input).initialQuantity, '10.500');
  assert.equal(batchInput(input).batchCode, 'B-001');
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
