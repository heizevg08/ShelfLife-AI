const { test } = require('node:test');
const assert = require('node:assert/strict');
const { accountInput } = require('../dist/validators/administration');
const { accountRequestReview } = require('../dist/validators/account-request');
const { recordCreateInput } = require('../dist/validators/inventory-record');
const { personNameInput, catalogueText, proseText, batchCodeInput } = require('../dist/validators/text');

const ids = { ingredientId: '1'.repeat(24), batchId: '2'.repeat(24) };

function manilaDate(offsetDays) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(value => value.type === type).value;
  const value = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

test('text validators allow the intended text and reject unsafe characters', () => {
  assert.equal(personNameInput("Ana-Maria O'Connor", 'firstName'), "Ana-Maria O'Connor");
  assert.equal(catalogueText('Food-grade bags (large)', 'name', true, 100), 'Food-grade bags (large)');
  assert.equal(proseText('Prepared for lunch: checked.', 'notes', true, 500), 'Prepared for lunch: checked.');
  assert.equal(batchCodeInput('B-104/2026'), 'B-104/2026');
  for (const invoke of [
    () => personNameInput('Ana123', 'firstName'),
    () => personNameInput('<script>', 'firstName'),
    () => catalogueText('Chicken <script>', 'name', true, 100),
    () => proseText('@#$@', 'notes', true, 500),
    () => batchCodeInput('BATCH @104'),
  ]) assert.throws(invoke);
});

test('account inputs reject disallowed names, unknown fields, and noncanonical roles', () => {
  const account = { firstName: 'Ana-Maria', lastName: "O'Connor", email: 'ana@shelflife.com', role: 'Inventory Staff', password: 'valid-password-only' };
  assert.equal(accountInput(account, true).role, 'Inventory Staff');
  for (const body of [
    { ...account, firstName: 'Ana123' },
    { ...account, lastName: 'O@Connor' },
    { ...account, role: 'Manager' },
    { ...account, role: 'Staff' },
    { ...account, isActive: false },
  ]) assert.throws(() => accountInput(body, true));
  assert.throws(() => accountInput({ firstName: 'Ana123' }, false));
  assert.throws(() => accountInput({ firstName: 'Ana', unexpected: true }, false));
});

test('account-request review notes use the prose contract', () => {
  assert.equal(accountRequestReview({ decision: 'Rejected', expectedVersion: 0, note: 'Please correct the submitted details.' }).note, 'Please correct the submitted details.');
  assert.throws(() => accountRequestReview({ decision: 'Rejected', expectedVersion: 0, note: '@#$@' }));
});

test('record inputs reject future Manila dates but accept historical dates', () => {
  const base = { ...ids, quantity: '1.250', notes: 'Prepared for lunch.' };
  assert.equal(recordCreateInput('UsageRecord', { ...base, recordedAt: '2019-06-18' }).recordedAt, '2019-06-18');
  assert.throws(() => recordCreateInput('UsageRecord', { ...base, recordedAt: manilaDate(1) }));
  assert.throws(() => recordCreateInput('UsageRecord', { ...base, recordedAt: manilaDate(-1), notes: '@#$@' }));
});
