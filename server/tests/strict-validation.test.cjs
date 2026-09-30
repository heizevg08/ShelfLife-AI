const { test } = require('node:test');
const assert = require('node:assert/strict');
const { accountInput } = require('../dist/validators/administration');
const { ingredientInput } = require('../dist/validators/ingredient');
const { changeRequestInput } = require('../dist/validators/change-request');
const { batchInput } = require('../dist/validators/inventory-batch');
const { recordCreateInput } = require('../dist/validators/inventory-record');

const ids = { ingredientId: '1'.repeat(24), batchId: '2'.repeat(24) };

test('identity, catalogue, operational text, dates, and identifiers have explicit contracts', () => {
  const account = { firstName: "Ana-Maria", lastName: "O'Connor", email: 'ana@shelflife.com', role: 'Inventory Staff', password: 'valid-password-only' };
  assert.equal(accountInput(account, true).lastName, "O'Connor");
  for (const body of [
    { ...account, firstName: 'Ana123' }, { ...account, lastName: 'O@Connor' },
    { ...account, firstName: '<script>' }, { ...account, firstName: { $ne: null } },
  ]) assert.throws(() => accountInput(body, true));

  const ingredient = { name: 'Chicken Breast (Boneless)', brand: 'Fresh-Farm', description: 'Trimmed, skinless breast.', category: 'Meat', unitOfMeasure: 'kg' };
  assert.equal(ingredientInput(ingredient).name, ingredient.name);
  for (const body of [
    { ...ingredient, name: 'Chicken <script>' }, { ...ingredient, brand: 'Fresh@Farm' },
    { ...ingredient, description: '@#$#@$#@' }, { ...ingredient, name: { $gt: '' } },
  ]) assert.throws(() => ingredientInput(body));

  const change = { target: 'Batch B-104 / Chicken Breast', type: 'Quantity correction', proposedCorrection: 'Set quantity to 8 kg.', reason: 'Physical count confirmed.' };
  assert.deepEqual(changeRequestInput(change), change);
  for (const body of [{ ...change, type: 'Approve everything' }, { ...change, target: 'Batch <script>' }, { ...change, reason: '@#$@' }]) assert.throws(() => changeRequestInput(body));

  const batch = { ingredientId: ids.ingredientId, batchCode: 'B-104/2026', initialQuantity: '10', unit: 'kg', unitCost: '4.5', dateReceived: '2026-09-01', expirationDate: '2026-10-01' };
  assert.equal(batchInput(batch).batchCode, batch.batchCode);
  assert.throws(() => batchInput({ ...batch, batchCode: 'BATCH @104' }));
});

test('usage and waste records reject invalid character payloads and implausible calendar dates', () => {
  const valid = { ...ids, quantity: '1.25', recordedAt: '2026-09-30', notes: 'Prepared for lunch.' };
  assert.equal(recordCreateInput('UsageRecord', valid).quantity, '1.250');
  for (const body of [
    { ...valid, quantity: '1@25' }, { ...valid, notes: '@#$@' },
    { ...valid, recordedAt: '1968-06-18' }, { ...valid, recordedAt: '2999-01-01' },
    { ...valid, ingredientId: { $ne: null } },
  ]) assert.throws(() => recordCreateInput('UsageRecord', body));
});
