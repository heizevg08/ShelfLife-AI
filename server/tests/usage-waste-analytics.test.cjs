const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { analyticsQuery } = require('../dist/validators/analytics');
const { aggregateRecordCounts } = require('../dist/services/analytics');
const { createUsageRecordStore } = require('../dist/services/usage-record-store');
const { createWasteRecordStore } = require('../dist/services/waste-record-store');

const ingredientId = '5'.repeat(24);
const otherId = '6'.repeat(24);
const on = value => new Date(value + 'T00:00:00.000Z');
const facet = (total, reasons = [], ingredients = [], daily = []) => [{ total: total ? [{ count: total }] : [], reasons, ingredients, daily }];
const withResult = result => async pipeline => { assert.equal(pipeline.at(-1).$facet.total[0].$count, 'count'); return result; };

test('date range is inclusive in the UI and exclusive at the query boundary', async () => {
  const query = analyticsQuery({ from: '2026-10-04', to: '2026-10-10' });
  let seen;
  const result = await aggregateRecordCounts(async pipeline => { seen = pipeline; return facet(2); }, query, 'dateUsed');
  assert.deepEqual(seen[0].$match.dateUsed, { $gte: on('2026-10-04'), $lt: on('2026-10-11') });
  assert.deepEqual(result.period, { from: '2026-10-04', to: '2026-10-10', label: '2026-10-04 to 2026-10-10' });
  assert.equal(result.total, 2);
  assert.equal(seen.at(-1).$facet.daily[0].$group._id.$dateToString.date, '$dateUsed');
});

test('all dates leave the aggregate unbounded; no table page limit or history cap', async () => {
  let seen;
  const result = await aggregateRecordCounts(async pipeline => { seen = pipeline; return facet(400); }, analyticsQuery({}), 'dateWasted');
  assert.deepEqual(seen[0].$match, {});
  assert.equal(seen.some(stage => '$limit' in stage || '$skip' in stage), false);
  assert.equal(result.total, 400);
  assert.equal(result.period.label, 'All dates');
});

test('category and ingredient scope are applied before all facets', async () => {
  let seen;
  await aggregateRecordCounts(async pipeline => { seen = pipeline; return facet(0); }, analyticsQuery({ category: 'Dairy', ingredientId }), 'dateWasted');
  assert.equal(seen[0].$match.ingredientId.toString(), ingredientId);
  assert.equal(seen[1].$lookup.from, 'ingredients');
  assert.deepEqual(seen[2].$match, { 'ingredient.category': 'Dairy' });
  assert.ok(seen[3].$facet.reasons && seen[3].$facet.ingredients);
});

test('waste reason counts, top five ranking and unavailable ingredients are truthful', async () => {
  const groups = [
    { _id: new Types.ObjectId(otherId), count: 3, name: 'Banana' },
    { _id: new Types.ObjectId(ingredientId), count: 3, name: 'Apple' },
    { _id: new Types.ObjectId('7'.repeat(24)), count: 1, name: null },
  ];
  const result = await aggregateRecordCounts(withResult(facet(7, [{ _id: 'Spoiled', count: 5 }, { _id: 'Other', count: 2 }], groups)), analyticsQuery({}), 'dateWasted');
  assert.deepEqual(result.byReason, { Expired: 0, Spoiled: 5, Damaged: 0, 'Over-prepared': 0, Other: 2 });
  assert.deepEqual(result.topIngredients.map(row => row.name), ['Apple', 'Banana', 'Unavailable ingredient (777777)']);
  assert.equal(result.unresolvedIngredientRecords, 1);
  assert.equal(result.total, 7);
});

test('usage and waste stores invoke database aggregation, not resolved table rows', async () => {
  const makeRecords = output => ({
    aggregate: pipeline => ({ exec: () => withResult(output)(pipeline) }),
    find: () => { throw new Error('analytics must not scan resolved rows'); },
  });
  const stub = {};
  const usage = createUsageRecordStore(stub, makeRecords(facet(1)), stub, stub, stub, stub);
  const waste = createWasteRecordStore(stub, makeRecords(facet(2)), stub, stub, stub, stub);
  assert.equal((await usage.analytics(analyticsQuery({}), new Date())).total, 1);
  assert.equal((await waste.analytics(analyticsQuery({}), new Date())).total, 2);
});

test('reversed ranges, unknown categories and unknown query keys are rejected', () => {
  for (const input of [{ from: '2026-10-10', to: '2026-10-04' }, { category: 'Unknown' }, { window: 'year' }]) {
    assert.throws(() => analyticsQuery(input), error => error.status === 400);
  }
});

test('equal start and end dates are valid', () => {
  const query = analyticsQuery({ from: '2026-10-10', to: '2026-10-10' });
  assert.equal(query.to.toISOString(), '2026-10-11T00:00:00.000Z');
});

test('daily counts are backend-derived and retain operational date order', async () => {
  const result = await aggregateRecordCounts(withResult(facet(3, [], [], [{ _id: '2026-10-09', count: 1 }, { _id: '2026-10-10', count: 2 }])), analyticsQuery({ from: '2026-10-09', to: '2026-10-10' }), 'dateWasted');
  assert.deepEqual(result.dailyCounts, [{ date: '2026-10-09', count: 1 }, { date: '2026-10-10', count: 2 }]);
  assert.equal(result.dailyCounts.reduce((sum, day) => sum + day.count, 0), result.total);
});
