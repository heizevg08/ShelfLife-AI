const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { createForecastSnapshotStore } = require('../dist/services/forecast-snapshot-store');
const { forecastSnapshotModel } = require('../dist/models/forecast-snapshot');

const id = value => ({ toString: () => String(value).padStart(24, '0') });
const ingredientId = id(10).toString();
const userId = id(99).toString();

test('forecast snapshot schema defines required indexes and collection contract', () => {
  const driver = new Mongoose();
  const model = forecastSnapshotModel(driver);
  assert.equal(model.collection.name, 'forecastSnapshots');

  const indexes = model.schema.indexes();
  // Verify compound unique index on (ingredientId, generatedDate, targetDate)
  const compoundUnique = indexes.find(([fields, opts]) =>
    fields.ingredientId === 1 && fields.generatedDate === 1 && fields.targetDate === 1 && opts?.unique === true,
  );
  assert.ok(compoundUnique, 'Compound unique index on (ingredientId, generatedDate, targetDate) must exist');

  // Verify TTL index on generatedAt
  const ttlIndex = indexes.find(([fields, opts]) =>
    fields.generatedAt === 1 && typeof opts?.expireAfterSeconds === 'number',
  );
  assert.ok(ttlIndex, 'TTL index on generatedAt must exist for 90-day retention');
});

test('saveSnapshots persists predictions with computed horizonDays and stepIndex', async () => {
  const records = [];
  const mockModel = {
    updateMany: () => ({ exec: async () => ({ modifiedCount: 0 }) }),
    findOneAndUpdate: (_filter, update) => {
      const doc = {
        _id: id(records.length + 1),
        ingredientId: _filter.ingredientId,
        generatedDate: _filter.generatedDate,
        targetDate: _filter.targetDate,
        ...update.$set,
      };
      records.push(doc);
      return {
        lean: () => ({ exec: async () => doc }),
      };
    },
  };

  const store = createForecastSnapshotStore(mockModel);
  const generatedAt = new Date('2026-10-20T08:00:00.000Z');

  const result = await store.saveSnapshots({
    ingredientId,
    unit: 'kg',
    createdBy: userId,
    predictions: [
      { date: '2026-10-21', predictedConsumption: 12.5 },
      { date: '2026-10-22', predictedConsumption: 14.0 },
      { date: '2026-10-23', predictedConsumption: -2.0 }, // negative clamped to 0
    ],
  }, generatedAt);

  assert.equal(result.length, 3);
  assert.equal(result[0].stepIndex, 0);
  assert.equal(result[0].horizonDays, 1);
  assert.equal(result[0].predictedQuantity, 12.5);
  assert.equal(result[0].status, 'ACTIVE');

  assert.equal(result[1].stepIndex, 1);
  assert.equal(result[1].horizonDays, 2);
  assert.equal(result[1].predictedQuantity, 14.0);

  // Negative prediction must clamp to 0
  assert.equal(result[2].stepIndex, 2);
  assert.equal(result[2].predictedQuantity, 0);
});

test('saveSnapshots marks earlier predictions for the same target dates as SUPERSEDED', async () => {
  let updateFilter = null;
  let updateSet = null;

  const mockModel = {
    updateMany: (filter, update) => {
      updateFilter = filter;
      updateSet = update;
      return { exec: async () => ({ modifiedCount: 1 }) };
    },
    findOneAndUpdate: (_filter, update) => {
      const doc = { _id: id(1), ..._filter, ...update.$set };
      return { lean: () => ({ exec: async () => doc }) };
    },
  };

  const store = createForecastSnapshotStore(mockModel);
  const generatedAt = new Date('2026-10-22T08:00:00.000Z');

  await store.saveSnapshots({
    ingredientId,
    unit: 'kg',
    createdBy: userId,
    predictions: [{ date: '2026-10-25', predictedConsumption: 20 }],
  }, generatedAt);

  assert.ok(updateFilter);
  assert.equal(updateFilter.ingredientId, ingredientId);
  assert.deepEqual(updateFilter.targetDate, { $in: ['2026-10-25'] });
  assert.equal(updateFilter.status, 'ACTIVE');
  assert.deepEqual(updateSet, { $set: { status: 'SUPERSEDED' } });
});

test('findSnapshots filters by ingredientId, status, and target date window', async () => {
  let appliedFilter = null;
  const mockRows = [
    { targetDate: '2026-10-21', predictedQuantity: 10, status: 'ACTIVE' },
    { targetDate: '2026-10-22', predictedQuantity: 12, status: 'ACTIVE' },
  ];

  const mockModel = {
    find: filter => {
      appliedFilter = filter;
      return {
        sort: () => ({
          lean: () => ({ exec: async () => mockRows }),
        }),
      };
    },
  };

  const store = createForecastSnapshotStore(mockModel);
  const result = await store.findSnapshots({
    ingredientId,
    status: 'ACTIVE',
    targetDateFrom: '2026-10-21',
    targetDateTo: '2026-10-22',
  });

  assert.equal(result.length, 2);
  assert.equal(appliedFilter.ingredientId, ingredientId);
  assert.equal(appliedFilter.status, 'ACTIVE');
  assert.deepEqual(appliedFilter.targetDate, {
    $gte: '2026-10-21',
    $lte: '2026-10-22',
  });
});

test('latestSnapshotForTargetDate finds the latest active prediction', async () => {
  let appliedFilter = null;
  const expectedDoc = {
    _id: id(5),
    ingredientId,
    targetDate: '2026-10-25',
    predictedQuantity: 15.5,
    status: 'ACTIVE',
  };

  const mockModel = {
    findOne: filter => {
      appliedFilter = filter;
      return {
        sort: () => ({
          lean: () => ({ exec: async () => expectedDoc }),
        }),
      };
    },
  };

  const store = createForecastSnapshotStore(mockModel);
  const result = await store.latestSnapshotForTargetDate(ingredientId, '2026-10-25');

  assert.deepEqual(result, expectedDoc);
  assert.equal(appliedFilter.ingredientId, ingredientId);
  assert.equal(appliedFilter.targetDate, '2026-10-25');
  assert.equal(appliedFilter.status, 'ACTIVE');
});
