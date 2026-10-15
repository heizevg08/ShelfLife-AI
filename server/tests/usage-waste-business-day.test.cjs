const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createUsageRecordStore } = require('../dist/services/usage-record-store');
const { createWasteRecordStore } = require('../dist/services/waste-record-store');
const { createUsageRecords } = require('../dist/services/usage-records');
const { createWasteRecords } = require('../dist/services/waste-records');
const { createInventoryBatchStore } = require('../dist/services/inventory-batch-store');

// Operational dates are date-only fields: the entered calendar date stored at UTC
// midnight, exactly as the calendarDate validator preserves it.
const on = (year, month, day) => new Date(Date.UTC(year, month - 1, day));

const ingredientId = '5'.repeat(24);
const batchId = '4'.repeat(24);
const staffId = '6'.repeat(24);

const chain = (rows) => ({ lean: () => ({ exec: async () => rows }) });
const selectable = (rows) => ({ select: () => chain(rows) });

const ingredientRow = { _id: { toString: () => ingredientId }, name: 'Milk', unitOfMeasure: 'L', category: 'Dairy', minimumStock: 0, standardUnitCost: 12 };
const batchRow = { _id: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, batchID: 'SL-001', quantity: 10, unit: 'L', unitCost: 12 };
const staffRow = { _id: { toString: () => staffId }, name: 'Ana Cruz', firstName: 'Ana', lastName: 'Cruz' };

function usageStoreFor(rows) {
  const records = { find: () => ({ sort: () => chain(rows) }) };
  const ingredients = { find: () => selectable([ingredientRow]) };
  const batches = { find: () => selectable([batchRow]) };
  const users = { find: () => selectable([staffRow]) };
  return createUsageRecordStore({ connection: {} }, records, batches, ingredients, users, {});
}

function wasteStoreFor(rows) {
  const records = { find: () => ({ sort: () => chain(rows) }) };
  const ingredients = { find: () => selectable([ingredientRow]) };
  const batches = { find: () => selectable([batchRow]) };
  const users = { find: () => selectable([staffRow]) };
  return createWasteRecordStore({ connection: {} }, records, batches, ingredients, users, {});
}

const usageRow = (dateUsed, quantityUsed = 2) => ({ _id: { toString: () => '1'.repeat(24) }, batchId: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, quantityUsed, unit: 'L', dateUsed, staffId: { toString: () => staffId }, createdAt: new Date('2026-10-01T00:00:00.000Z') });
const wasteRow = (dateWasted, quantityWasted = 3) => ({ _id: { toString: () => '2'.repeat(24) }, batchId: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, quantityWasted, unit: 'L', reason: 'Spoiled', wasteCost: 24, dateWasted, recordedBy: { toString: () => staffId }, createdAt: new Date('2026-10-01T00:00:00.000Z') });

test('Usage Today follows the Philippine calendar, not the host clock or a UTC day', async () => {
  const store = usageStoreFor([usageRow(on(2026, 10, 10))]);
  // 23:59:59 Manila on 10 October: the 10th is still "today".
  assert.equal((await store.summary(new Date('2026-10-10T15:59:59.999Z'))).usageRecordsToday, 1);
  // One millisecond later it is 00:00 Manila on the 11th, so the 10th is yesterday.
  assert.equal((await store.summary(new Date('2026-10-10T16:00:00.000Z'))).usageRecordsToday, 0);

  const onEleventh = usageStoreFor([usageRow(on(2026, 10, 11))]);
  assert.equal((await onEleventh.summary(new Date('2026-10-10T16:00:00.000Z'))).usageRecordsToday, 1);
});

test('Waste Today follows the Philippine calendar', async () => {
  const store = wasteStoreFor([wasteRow(on(2026, 10, 10))]);
  assert.equal((await store.summary(new Date('2026-10-10T15:59:59.999Z'))).wasteRecordsToday, 1);
  assert.equal((await store.summary(new Date('2026-10-10T16:00:00.000Z'))).wasteRecordsToday, 0);
  const onEleventh = wasteStoreFor([wasteRow(on(2026, 10, 11))]);
  assert.equal((await onEleventh.summary(new Date('2026-10-10T16:00:00.000Z'))).wasteRecordsToday, 1);
});

test('Usage, Waste and Stock-In agree on the same definition of Today', async () => {
  const batches = { find: () => ({ sort: () => chain([{ _id: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, batchID: 'SL-001', quantity: 10, unit: 'L', dateReceived: on(2026, 10, 10), expirationDate: on(2026, 11, 10), createdBy: { toString: () => staffId }, createdAt: new Date(0), updatedAt: new Date(0) }]) }) };
  const ingredients = { find: () => selectable([ingredientRow]) };
  const users = { find: () => selectable([]) };
  const stockIn = createInventoryBatchStore({ connection: {} }, batches, {}, ingredients, users, {});

  // The same instant, either side of Philippine midnight, must move all three together.
  const lateTenth = new Date('2026-10-10T15:59:59.999Z');
  const earlyEleventh = new Date('2026-10-10T16:00:00.000Z');
  const usage = usageStoreFor([usageRow(on(2026, 10, 10))]);
  const waste = wasteStoreFor([wasteRow(on(2026, 10, 10))]);

  assert.deepEqual([
    (await usage.summary(lateTenth)).usageRecordsToday,
    (await waste.summary(lateTenth)).wasteRecordsToday,
    (await stockIn.stockInSummary(lateTenth)).stockInToday,
  ], [1, 1, 1]);
  assert.deepEqual([
    (await usage.summary(earlyEleventh)).usageRecordsToday,
    (await waste.summary(earlyEleventh)).wasteRecordsToday,
    (await stockIn.stockInSummary(earlyEleventh)).stockInToday,
  ], [0, 0, 0]);
});

test('the Waste 30-day breakdown counts Philippine calendar days across the year end', async () => {
  // 18:00 Manila on 31 October: the last 30 business days start on 2 October.
  const monthRef = new Date('2026-10-31T10:00:00.000Z');
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 10, 2))]).reasonBreakdown(monthRef)).total, 1);
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 10, 1))]).reasonBreakdown(monthRef)).total, 0);
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 10, 31))]).reasonBreakdown(monthRef)).total, 1);

  // 16:30 UTC on 31 December is 00:30 Manila on 1 January, so the window spans the
  // year boundary and starts on 3 December. The start instant is inclusive.
  const yearRef = new Date('2026-12-31T16:30:00.000Z');
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 12, 3))]).reasonBreakdown(yearRef)).total, 1);
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 12, 2))]).reasonBreakdown(yearRef)).total, 0);
  assert.equal((await wasteStoreFor([wasteRow(on(2027, 1, 1))]).reasonBreakdown(yearRef)).total, 1);
  // A record from the previous year that is still inside the window is counted.
  assert.equal((await wasteStoreFor([wasteRow(on(2026, 12, 31))]).reasonBreakdown(yearRef)).total, 1);
});

test('a legitimately backdated record is counted on its own operational date, not today', async () => {
  // Recorded today (UTC createdAt) but used on 5 October: the operational date wins.
  const store = usageStoreFor([usageRow(on(2026, 10, 5))]);
  const summary = await store.summary(new Date('2026-10-10T10:00:00.000Z'));
  assert.equal(summary.usageRecordsToday, 0);
  const onFifth = await store.summary(new Date('2026-10-05T10:00:00.000Z'));
  assert.equal(onFifth.usageRecordsToday, 1);
});

test('the month-end and year-end boundaries resolve to Philippine midnight instants', async () => {
  const { businessDayBounds, businessDayBoundsForCalendarDate, recentBusinessCalendarBounds } = require('../dist/utils/business-day');
  const monthEnd = businessDayBounds(new Date('2026-10-31T10:00:00.000Z'));
  assert.equal(monthEnd.start.toISOString(), '2026-10-30T16:00:00.000Z');
  assert.equal(monthEnd.end.toISOString(), '2026-10-31T16:00:00.000Z');

  const yearEnd = businessDayBoundsForCalendarDate('2026-12-31');
  assert.equal(yearEnd.start.toISOString(), '2026-12-30T16:00:00.000Z');
  assert.equal(yearEnd.end.toISOString(), '2026-12-31T16:00:00.000Z');

  const thirty = recentBusinessCalendarBounds(new Date('2027-01-01T10:00:00.000Z'), 30);
  assert.equal(thirty.end.toISOString(), '2027-01-01T16:00:00.000Z');
  // 30 whole days inclusive: 3 December through 1 January.
  assert.equal(thirty.start.toISOString(), '2026-12-02T16:00:00.000Z');
});

test('the future-date guard compares business calendar dates, not instants', () => {
  // 20:00 Manila on 10 October: a record dated the 10th is allowed, one dated the 11th is not.
  const evening = () => new Date('2026-10-10T12:00:00.000Z');
  const usage = createUsageRecords({}, evening);
  const waste = createWasteRecords({}, evening);

  // The guard reports the field-level reason in `details`, matching the API contract.
  const futureReason = (fn) => { try { fn(); } catch (error) { return error.details?.[0]?.message; } return null; };
  const actor = { id: staffId, name: 'Ana', role: 'Inventory Staff' };
  const todayUsage = { ingredientId, batchId, dateUsed: on(2026, 10, 10), quantityUsed: 1 };
  const tomorrowUsage = { ingredientId, batchId, dateUsed: on(2026, 10, 11), quantityUsed: 1 };
  assert.equal(futureReason(() => usage.create(actor, tomorrowUsage)), 'Date used cannot be in the future');
  assert.equal(futureReason(() => usage.createMany(actor, [tomorrowUsage])), 'Date used cannot be in the future');
  // Dated today: it must not be rejected for being in the future (storage errors are separate).
  assert.notEqual(futureReason(() => usage.create(actor, todayUsage)), 'Date used cannot be in the future');

  const todayWaste = { ingredientId, batchId, dateWasted: on(2026, 10, 10), quantityWasted: 1, reason: 'Spoiled' };
  const tomorrowWaste = { ingredientId, batchId, dateWasted: on(2026, 10, 11), quantityWasted: 1, reason: 'Spoiled' };
  assert.equal(futureReason(() => waste.create(actor, tomorrowWaste)), 'Date wasted cannot be in the future');
  assert.equal(futureReason(() => waste.createMany(actor, [tomorrowWaste])), 'Date wasted cannot be in the future');
  assert.notEqual(futureReason(() => waste.create(actor, todayWaste)), 'Date wasted cannot be in the future');

  // Late Philippine evening must still accept a record dated that same day, even
  // though the UTC date has not rolled over yet.
  assert.equal(require('../dist/utils/business-day').businessDateString(evening()), '2026-10-10');
});

test('date-only operational fields keep their calendar date and FEFO order is unaffected', async () => {
  const dateUsed = on(2026, 10, 5);
  const dateWasted = on(2026, 10, 6);
  await usageStoreFor([usageRow(dateUsed)]).summary(new Date('2026-10-10T16:30:00.000Z'));
  await wasteStoreFor([wasteRow(dateWasted)]).summary(new Date('2026-10-10T16:30:00.000Z'));
  assert.equal(dateUsed.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(dateWasted.toISOString(), '2026-10-06T00:00:00.000Z');

  const { dateOnlyCalendarString } = require('../dist/utils/business-day');
  assert.equal(dateOnlyCalendarString(dateUsed), '2026-10-05');
  assert.equal(dateOnlyCalendarString(new Date('2026-12-31T00:00:00.000Z')), '2026-12-31');

  const early = { _id: { toString: () => '7'.repeat(24) }, ingredientId: { toString: () => ingredientId }, batchID: 'A', quantity: 1, unit: 'L', dateReceived: on(2026, 10, 1), expirationDate: on(2026, 10, 20), createdBy: { toString: () => staffId }, createdAt: new Date(0), updatedAt: new Date(0) };
  const late = { ...early, _id: { toString: () => '8'.repeat(24) }, batchID: 'B', expirationDate: on(2026, 11, 15) };
  const batches = { find: () => ({ sort: () => chain([early, late]) }) };
  const store = createInventoryBatchStore({ connection: {} }, batches, {}, { find: () => selectable([ingredientRow]) }, { find: () => selectable([]) }, {});
  const page = await store.list({ page: 1, pageSize: 10, sort: 'fefo' }, new Date('2026-10-10T16:30:00.000Z'));
  assert.deepEqual(page.items.map(item => item.expirationDate), ['2026-10-20T00:00:00.000Z', '2026-11-15T00:00:00.000Z']);
});

test('the same Usage and Waste records report the same totals under any host timezone', () => {
  const script = path.join(__dirname, '..', '..', '.sl-usage-waste-tz-probe.cjs');
  const probe = `
    const { createUsageRecordStore } = require(${JSON.stringify(path.join(__dirname, '../dist/services/usage-record-store'))});
    const { createWasteRecordStore } = require(${JSON.stringify(path.join(__dirname, '../dist/services/waste-record-store'))});
    const ingredientId = '5'.repeat(24), batchId = '4'.repeat(24), staffId = '6'.repeat(24);
    const on = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
    const chain = (rows) => ({ lean: () => ({ exec: async () => rows }) });
    const selectable = (rows) => ({ select: () => chain(rows) });
    const ingredientRow = { _id: { toString: () => ingredientId }, name: 'Milk', unitOfMeasure: 'L', standardUnitCost: 12 };
    const batchRow = { _id: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, batchID: 'B', quantity: 10, unit: 'L' };
    const staffRow = { _id: { toString: () => staffId }, name: 'Ana', firstName: 'Ana', lastName: 'Cruz' };
    const usageRow = { _id: { toString: () => '1'.repeat(24) }, batchId: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, quantityUsed: 2, unit: 'L', dateUsed: on(2026, 10, 10), staffId: { toString: () => staffId }, createdAt: new Date(0) };
    const wasteRow = { _id: { toString: () => '2'.repeat(24) }, batchId: { toString: () => batchId }, ingredientId: { toString: () => ingredientId }, quantityWasted: 3, unit: 'L', reason: 'Spoiled', wasteCost: 24, dateWasted: on(2026, 10, 10), recordedBy: { toString: () => staffId }, createdAt: new Date(0) };
    const usage = createUsageRecordStore({ connection: {} }, { find: () => ({ sort: () => chain([usageRow]) }) }, { find: () => selectable([batchRow]) }, { find: () => selectable([ingredientRow]) }, { find: () => selectable([staffRow]) }, {});
    const waste = createWasteRecordStore({ connection: {} }, { find: () => ({ sort: () => chain([wasteRow]) }) }, { find: () => selectable([batchRow]) }, { find: () => selectable([ingredientRow]) }, { find: () => selectable([staffRow]) }, {});
    const at = new Date('2026-10-10T16:30:00.000Z');
    Promise.all([usage.summary(at), waste.summary(at), waste.reasonBreakdown(at)]).then(([u, w, b]) => console.log(JSON.stringify([u.usageRecordsToday, w.wasteRecordsToday, b.total])));
  `;
  require('node:fs').writeFileSync(script, probe, 'utf8');
  try {
    const results = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'].map(zone => {
      const run = spawnSync(process.execPath, [script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
      assert.equal(run.status, 0, `probe failed under TZ=${zone}: ${run.stderr}`);
      return run.stdout.trim();
    });
    for (const result of results) assert.equal(result, results[0]);
    // 16:30 UTC is 00:30 Manila on the 11th, so the 10th is no longer today, but
    // it is still inside the 30-day window.
    assert.deepEqual(JSON.parse(results[0]), [0, 0, 1]);
  } finally {
    require('node:fs').rmSync(script, { force: true });
  }
});
