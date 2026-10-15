const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { analyticsQuery } = require('../dist/validators/analytics');
const { aggregateRecordCounts } = require('../dist/services/analytics');

test('Mongo analytics counts all matching operational records with category and reason scope', async t => {
  const mongo = await MongoMemoryServer.create();
  const driver = new Mongoose();
  await driver.connect(mongo.getUri('shelflifeai_analytics_test'));
  t.after(async () => { await driver.disconnect(); await mongo.stop(); });
  const dairy = new driver.Types.ObjectId();
  const produce = new driver.Types.ObjectId();
  const missing = new driver.Types.ObjectId();
  await driver.connection.collection('ingredients').insertMany([
    { _id: dairy, name: 'Milk', category: 'Dairy' },
    { _id: produce, name: 'Banana', category: 'Produce' },
  ]);
  const day = new Date('2026-10-10T00:00:00Z');
  const outside = new Date('2026-10-11T00:00:00Z');
  await driver.connection.collection('usageRecords').insertMany([
    ...Array.from({ length: 160 }, () => ({ ingredientId: dairy, dateUsed: day })),
    { ingredientId: produce, dateUsed: day },
    { ingredientId: missing, dateUsed: day },
    { ingredientId: dairy, dateUsed: outside },
  ]);
  await driver.connection.collection('wasteRecords').insertMany([
    { ingredientId: dairy, dateWasted: day, reason: 'Spoiled' },
    { ingredientId: dairy, dateWasted: day, reason: 'Expired' },
    { ingredientId: produce, dateWasted: day, reason: 'Spoiled' },
  ]);
  const scope = analyticsQuery({ from: '2026-10-10', to: '2026-10-10' });
  const run = collection => pipeline => driver.connection.collection(collection).aggregate(pipeline).toArray();
  const usage = await aggregateRecordCounts(run('usageRecords'), scope, 'dateUsed');
  assert.equal(usage.total, 162);
  assert.deepEqual(usage.dailyCounts, [{ date: '2026-10-10', count: 162 }]);
  assert.equal(usage.unresolvedIngredientRecords, 1);
  assert.deepEqual(usage.topIngredients.map(row => row.count), [160, 1, 1]);
  const dairyUsage = await aggregateRecordCounts(run('usageRecords'), analyticsQuery({ from: '2026-10-10', to: '2026-10-10', category: 'Dairy' }), 'dateUsed');
  assert.equal(dairyUsage.total, 160);
  assert.deepEqual(dairyUsage.dailyCounts, [{ date: '2026-10-10', count: 160 }]);
  const waste = await aggregateRecordCounts(run('wasteRecords'), scope, 'dateWasted');
  assert.equal(waste.total, 3);
  assert.deepEqual(waste.dailyCounts, [{ date: '2026-10-10', count: 3 }]);
  assert.equal(waste.byReason.Spoiled, 2);
  assert.equal(waste.byReason.Expired, 1);
  assert.deepEqual(waste.topIngredients.map(row => row.count), [2, 1]);
});
