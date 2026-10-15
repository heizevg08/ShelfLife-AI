const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createInventoryBatchStore } = require('../dist/services/inventory-batch-store');
const { businessMonthBounds } = require('../dist/utils/business-day');

// A date-only Stock-In field: the receipt date stored at UTC midnight, the way
// the calendarDate validator preserves an entered calendar date.
const receivedOn = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

const ingredientId = '5'.repeat(24);
const userId = '6'.repeat(24);

function fakeCollections(rows) {
  const batches = { find: () => ({ sort: () => ({ lean: () => ({ exec: async () => rows }) }) }) };
  const ingredients = {
    find: () => ({
      select: () => ({ lean: () => ({ exec: async () => [{ _id: { toString: () => ingredientId }, name: 'Milk', category: 'Dairy', unitOfMeasure: 'L' }] }) }),
    }),
  };
  const users = { find: () => ({ select: () => ({ lean: () => ({ exec: async () => [] }) }) }) };
  return { batches, ingredients, users };
}

function batchRow(dateReceived, expirationDate) {
  return {
    _id: { toString: () => '4'.repeat(24) },
    ingredientId: { toString: () => ingredientId },
    batchID: 'SL-BATCH-001', quantity: 1, unit: 'L',
    dateReceived, expirationDate,
    createdBy: { toString: () => userId },
    createdAt: new Date('2026-10-01T00:00:00.000Z'), updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };
}

function storeFor(rows) {
  const { batches, ingredients, users } = fakeCollections(rows);
  // Only create() uses the driver transaction; the read paths under test do not.
  return createInventoryBatchStore({ connection: {} }, batches, {}, ingredients, users, {});
}

test('a Stock-In day follows the Philippine calendar, not the host clock', async () => {
  // 23:59:59 Manila on 10 October 2026: a batch received on the 10th is still "today".
  const beforeMidnight = new Date('2026-10-10T15:59:59.999Z');
  const store = storeFor([batchRow(receivedOn(2026, 10, 10), receivedOn(2026, 11, 10))]);
  assert.equal((await store.stockInSummary(beforeMidnight)).stockInToday, 1);

  // The same instant one millisecond past Philippine midnight is the 11th, so a
  // batch received on the 10th is no longer "today".
  const afterMidnight = new Date('2026-10-10T16:00:00.000Z');
  assert.equal((await store.stockInSummary(afterMidnight)).stockInToday, 0);
});

test('Stock-In Today reflects the Philippine day across the UTC date boundary', async () => {
  const onTenth = storeFor([batchRow(receivedOn(2026, 10, 10), receivedOn(2026, 11, 10))]);
  const onEleventh = storeFor([batchRow(receivedOn(2026, 10, 11), receivedOn(2026, 11, 10))]);

  // 10:00 UTC on the 10th is 18:00 Manila on the 10th.
  assert.equal((await onTenth.stockInSummary(new Date('2026-10-10T10:00:00.000Z'))).stockInToday, 1);
  assert.equal((await onEleventh.stockInSummary(new Date('2026-10-10T10:00:00.000Z'))).stockInToday, 0);

  // 16:30 UTC on the 10th is already 00:30 Manila on the 11th.
  assert.equal((await onTenth.stockInSummary(new Date('2026-10-10T16:30:00.000Z'))).stockInToday, 0);
  assert.equal((await onEleventh.stockInSummary(new Date('2026-10-10T16:30:00.000Z'))).stockInToday, 1);
});

test('the monthly Stock-In total follows the Philippine month, not a host-local month', async () => {
  const onLastDay = storeFor([batchRow(receivedOn(2026, 10, 31), receivedOn(2026, 12, 1))]);
  const onFirstDay = storeFor([batchRow(receivedOn(2026, 11, 1), receivedOn(2026, 12, 5))]);

  // 10:00 UTC on 31 October is 18:00 Manila, still October.
  assert.equal((await onLastDay.stockInSummary(new Date('2026-10-31T10:00:00.000Z'))).batchesReceivedThisMonth, 1);
  // 16:30 UTC on 31 October is 00:30 Manila on 1 November, so the month has rolled.
  assert.equal((await onLastDay.stockInSummary(new Date('2026-10-31T16:30:00.000Z'))).batchesReceivedThisMonth, 0);
  assert.equal((await onFirstDay.stockInSummary(new Date('2026-10-31T16:30:00.000Z'))).batchesReceivedThisMonth, 1);
});

test('the monthly Stock-In total rolls over correctly at year end', async () => {
  const december = storeFor([batchRow(receivedOn(2026, 12, 31), receivedOn(2027, 3, 1))]);
  const january = storeFor([batchRow(receivedOn(2027, 1, 1), receivedOn(2027, 3, 1))]);

  assert.equal((await december.stockInSummary(new Date('2026-12-31T10:00:00.000Z'))).batchesReceivedThisMonth, 1);
  assert.equal((await december.stockInSummary(new Date('2026-12-31T16:30:00.000Z'))).batchesReceivedThisMonth, 0);
  assert.equal((await january.stockInSummary(new Date('2026-12-31T16:30:00.000Z'))).batchesReceivedThisMonth, 1);
});

test('the business month starts on the first Philippine day and ends before the next', () => {
  const october = businessMonthBounds(new Date('2026-10-15T00:00:00.000Z'));
  assert.equal(october.start.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(october.end.toISOString(), '2026-10-31T16:00:00.000Z');

  const december = businessMonthBounds(new Date('2026-12-05T00:00:00.000Z'));
  assert.equal(december.start.toISOString(), '2026-11-30T16:00:00.000Z');
  assert.equal(december.end.toISOString(), '2026-12-31T16:00:00.000Z');
});

test('the same Stock-In records report the same total under any host timezone', () => {
  const script = path.join(__dirname, '..', '..', '.sl-stockin-tz-probe.cjs');
  const probe = `
    const { test } = require('node:test');
    const { createInventoryBatchStore } = require(${JSON.stringify(path.join(__dirname, '../dist/services/inventory-batch-store'))});
    const ingredientId = '5'.repeat(24), userId = '6'.repeat(24);
    const row = { _id: { toString: () => '4'.repeat(24) }, ingredientId: { toString: () => ingredientId }, batchID: 'B', quantity: 1, unit: 'L', dateReceived: new Date(Date.UTC(2026, 9, 10)), expirationDate: new Date(Date.UTC(2026, 10, 10)), createdBy: { toString: () => userId }, createdAt: new Date(0), updatedAt: new Date(0) };
    const batches = { find: () => ({ sort: () => ({ lean: () => ({ exec: async () => [row] }) }) }) };
    const ingredients = { find: () => ({ select: () => ({ lean: () => ({ exec: async () => [{ _id: { toString: () => ingredientId }, name: 'Milk', category: 'Dairy', unitOfMeasure: 'L' }] }) }) }) };
    const users = { find: () => ({ select: () => ({ lean: () => ({ exec: async () => [] }) }) }) };
    const store = createInventoryBatchStore({ connection: {} }, batches, {}, ingredients, users, {});
    store.stockInSummary(new Date('2026-10-10T16:30:00.000Z')).then(summary => console.log(JSON.stringify([summary.stockInToday, summary.batchesReceivedThisMonth])));
  `;
  require('node:fs').writeFileSync(script, probe, 'utf8');
  try {
    const results = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'].map(zone => {
      const run = spawnSync(process.execPath, [script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
      assert.equal(run.status, 0, `probe failed under TZ=${zone}: ${run.stderr}`);
      return run.stdout.trim();
    });
    for (const result of results) assert.equal(result, results[0]);
    // 16:30 UTC is 00:30 Manila on the 11th, so the 10th's receipt is yesterday.
    assert.deepEqual(JSON.parse(results[0]), [0, 1]);
  } finally {
    require('node:fs').rmSync(script, { force: true });
  }
});

test('Stock-In summaries never rewrite the stored date-only receipt or expiration dates', async () => {
  const dateReceived = receivedOn(2026, 10, 11);
  const expirationDate = receivedOn(2026, 11, 20);
  const store = storeFor([batchRow(dateReceived, expirationDate)]);
  await store.stockInSummary(new Date('2026-10-10T16:30:00.000Z'));
  // The helper only reads; the stored dates must keep their exact instants.
  assert.equal(dateReceived.toISOString(), '2026-10-11T00:00:00.000Z');
  assert.equal(expirationDate.toISOString(), '2026-11-20T00:00:00.000Z');
});

test('FEFO ordering is unchanged by the Stock-In business-day correction', async () => {
  const early = batchRow(receivedOn(2026, 10, 1), receivedOn(2026, 10, 20));
  const late = { ...batchRow(receivedOn(2026, 10, 2), receivedOn(2026, 11, 15)), _id: { toString: () => '7'.repeat(24) } };
  const store = storeFor([early, late]);
  const page = await store.list({ page: 1, pageSize: 10, sort: 'fefo' }, new Date('2026-10-10T16:30:00.000Z'));
  assert.deepEqual(page.items.map(item => item.expirationDate), ['2026-10-20T00:00:00.000Z', '2026-11-15T00:00:00.000Z']);
});
