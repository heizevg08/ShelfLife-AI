const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createForecastEvaluationService, EVALUATION_MINIMUM_REQUIRED_DAYS } = require('../dist/services/forecast-evaluation-service');

const id = value => ({ toString: () => String(value).padStart(24, '0') });
const ingredientId = id(10).toString();
const ingredientRecord = {
  _id: id(10),
  name: 'Chicken Breast',
  unitOfMeasure: 'kg',
};

function mockIngredientModel(found = true) {
  return {
    findById: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => (found ? ingredientRecord : null),
        }),
      }),
    }),
  };
}

test('evaluateAccuracy returns NOT_FOUND when ingredient does not exist', async () => {
  const service = createForecastEvaluationService(
    mockIngredientModel(false),
    { find: () => ({ select: () => ({ lean: () => ({ exec: async () => [] }) }) }) },
    { findSnapshots: async () => [] },
  );

  const result = await service.evaluateAccuracy(ingredientId);
  assert.equal(result.status, 'NOT_FOUND');
});

test('evaluateAccuracy returns UNAVAILABLE when no snapshots exist', async () => {
  const service = createForecastEvaluationService(
    mockIngredientModel(true),
    { find: () => ({ select: () => ({ lean: () => ({ exec: async () => [] }) }) }) },
    { findSnapshots: async () => [] },
  );

  const result = await service.evaluateAccuracy(ingredientId);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'NO_FORECASTS');
  assert.equal(result.evaluatedDays, 0);
  assert.equal(result.minimumRequiredDays, EVALUATION_MINIMUM_REQUIRED_DAYS);
});

test('evaluateAccuracy returns UNAVAILABLE when evaluated days is less than minimum 7', async () => {
  const mockSnapshots = [
    { targetDate: '2026-10-10', predictedQuantity: 10 },
    { targetDate: '2026-10-11', predictedQuantity: 12 },
    { targetDate: '2026-10-12', predictedQuantity: 15 },
  ];

  const mockUsageRows = [
    { dateUsed: new Date('2026-10-10T04:00:00.000Z'), quantityUsed: 11, unit: 'kg' },
    { dateUsed: new Date('2026-10-11T04:00:00.000Z'), quantityUsed: 13, unit: 'kg' },
    { dateUsed: new Date('2026-10-12T04:00:00.000Z'), quantityUsed: 14, unit: 'kg' },
  ];

  const service = createForecastEvaluationService(
    mockIngredientModel(true),
    { find: () => ({ select: () => ({ lean: () => ({ exec: async () => mockUsageRows }) }) }) },
    { findSnapshots: async () => mockSnapshots },
  );

  const referenceDate = new Date('2026-10-15T08:00:00.000Z');
  const result = await service.evaluateAccuracy(ingredientId, referenceDate);

  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'INSUFFICIENT_EVALUATION_DATA');
  assert.equal(result.evaluatedDays, 3);
  assert.equal(result.minimumRequiredDays, 7);
});

test('evaluateAccuracy computes MAE, RMSE, WAPE, and AccuracyScore truthfully with 7+ days', async () => {
  // 7 matched days
  // actuals:   [10, 12, 14, 16, 18, 20, 22]
  // predicted: [12, 10, 15, 14, 20, 18, 24]
  // abs diffs: [ 2,  2,  1,  2,  2,  2,  2] => sum = 13. MAE = 13 / 7 = 1.86
  // sq diffs:  [ 4,  4,  1,  4,  4,  4,  4] => sum = 25. RMSE = sqrt(25 / 7) = sqrt(3.5714) = 1.89
  // sumActual: 10+12+14+16+18+20+22 = 112. WAPE = 13 / 112 = 0.1161 => 11.61%
  // Accuracy = 100 - 11.61 = 88.4%

  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  const actuals = [10, 12, 14, 16, 18, 20, 22];
  const predicted = [12, 10, 15, 14, 20, 18, 24];

  const mockSnapshots = dates.map((d, i) => ({
    targetDate: d,
    predictedQuantity: predicted[i],
    status: 'ACTIVE',
  }));

  const mockUsageRows = dates.map((d, i) => ({
    dateUsed: new Date(`${d}T04:00:00.000Z`),
    quantityUsed: actuals[i],
    unit: 'kg',
  }));

  const service = createForecastEvaluationService(
    mockIngredientModel(true),
    { find: () => ({ select: () => ({ lean: () => ({ exec: async () => mockUsageRows }) }) }) },
    { findSnapshots: async () => mockSnapshots },
  );

  const referenceDate = new Date('2026-10-10T08:00:00.000Z');
  const result = await service.evaluateAccuracy(ingredientId, referenceDate);

  assert.equal(result.status, 'AVAILABLE');
  assert.equal(result.metrics.evaluatedDays, 7);
  assert.equal(result.metrics.mae, 1.86);
  assert.equal(result.metrics.rmse, 1.89);
  assert.equal(result.metrics.wape, 0.1161);
  assert.equal(result.metrics.accuracyScore, 88.4);
});

test('evaluateAccuracy excludes today from completed evaluation to avoid partial-day distortion', async () => {
  let queriedDateFilter = null;
  const mockSnapshots = [{ targetDate: '2026-10-18', predictedQuantity: 10 }];

  const mockUsage = {
    find: filter => {
      queriedDateFilter = filter;
      return { select: () => ({ lean: () => ({ exec: async () => [] }) }) };
    },
  };

  const service = createForecastEvaluationService(
    mockIngredientModel(true),
    mockUsage,
    { findSnapshots: async () => mockSnapshots },
  );

  const today = new Date('2026-10-19T10:00:00.000Z'); // Philippine daytime
  await service.evaluateAccuracy(ingredientId, today);

  assert.ok(queriedDateFilter);
  // dateUsed must be strictly less than the end of yesterday (Philippine calendar)
  assert.ok(queriedDateFilter.dateUsed.$lt instanceof Date);
  assert.ok(queriedDateFilter.dateUsed.$lt.getTime() < today.getTime());
});

test('trendSeries returns daily points with null gaps preserved and correct meta', async () => {
  const mockSnapshots = [
    { targetDate: '2026-10-18', predictedQuantity: 15 },
    { targetDate: '2026-10-19', predictedQuantity: 18 },
  ];

  const mockUsageRows = [
    { dateUsed: new Date('2026-10-17T04:00:00.000Z'), quantityUsed: 12, unit: 'kg' },
    { dateUsed: new Date('2026-10-19T04:00:00.000Z'), quantityUsed: 17, unit: 'kg' },
  ];

  const service = createForecastEvaluationService(
    mockIngredientModel(true),
    { find: () => ({ select: () => ({ lean: () => ({ exec: async () => mockUsageRows }) }) }) },
    { findSnapshots: async () => mockSnapshots },
  );

  const referenceDate = new Date('2026-10-19T08:00:00.000Z');
  const result = await service.trendSeries(ingredientId, 3, referenceDate);

  assert.equal(result.status, 'FOUND');
  assert.equal(result.points.length, 3);
  assert.equal(result.meta.ingredient, 'Chicken Breast');
  assert.equal(result.meta.unit, 'kg');
  assert.equal(result.meta.horizonDays, 3);

  // Check gap handling: 2026-10-17 has actual=12, forecast=null
  const oct17 = result.points.find(p => p.date === '2026-10-17');
  assert.ok(oct17);
  assert.equal(oct17.actual, 12);
  assert.equal(oct17.forecast, null);

  // Check gap handling: 2026-10-18 has actual=null, forecast=15
  const oct18 = result.points.find(p => p.date === '2026-10-18');
  assert.ok(oct18);
  assert.equal(oct18.actual, null);
  assert.equal(oct18.forecast, 15);

  // Check matched day: 2026-10-19 has actual=17, forecast=18
  const oct19 = result.points.find(p => p.date === '2026-10-19');
  assert.ok(oct19);
  assert.equal(oct19.actual, 17);
  assert.equal(oct19.forecast, 18);
});

test('HTTP API gates forecast evaluation endpoints to Admin and Manager with truthful responses', async () => {
  const { createServer } = require('node:http');
  const { once } = require('node:events');
  const { randomBytes } = require('node:crypto');
  const { createApp } = require('../dist/app');
  const { createAuth } = require('../dist/services/auth');

  const admin = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Admin', email: 'admin@shelflife.com', role: 'Admin', isActive: true, authVersion: 0 };
  const manager = { id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Manager', email: 'manager@shelflife.com', role: 'Manager', isActive: true, authVersion: 0 };
  const staff = { id: '3'.repeat(24), _id: '3'.repeat(24), name: 'Staff', email: 'staff@shelflife.com', role: 'Inventory Staff', isActive: true, authVersion: 0 };

  const users = [admin, manager, staff];
  const auth = createAuth({ byId: async uid => users.find(u => u.id === uid) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));

  const dummyIngredientService = {
    async categories() { return []; },
    async stockInOptions() { return []; },
    async summary() { return {}; },
    async list() { return { items: [], page: 1, pageSize: 10, total: 0 }; },
  };

  const evaluationService = {
    async evaluateOverallAccuracy() {
      return {
        status: 'AVAILABLE',
        metrics: {
          evaluatedDays: 14,
          minimumRequiredDays: 7,
          mae: 2.1,
          rmse: 2.5,
          wape: 0.12,
          accuracyScore: 88.0,
        },
      };
    },
    async evaluateAccuracy(ingId) {
      if (ingId === '4'.repeat(24)) return { status: 'NOT_FOUND' };
      return {
        status: 'AVAILABLE',
        ingredientId: ingId,
        unit: 'kg',
        metrics: {
          evaluatedDays: 14,
          minimumRequiredDays: 7,
          mae: 2.1,
          rmse: 2.5,
          wape: 0.12,
          accuracyScore: 88.0,
        },
      };
    },
    async trendSeries(ingId, days = 30) {
      if (ingId === '4'.repeat(24)) return { status: 'NOT_FOUND', points: [] };
      return {
        status: 'FOUND',
        ingredientId: ingId,
        unit: 'kg',
        points: [{ date: '2026-10-19', forecast: 10, actual: 12 }],
        meta: { ingredient: 'Chicken Breast', unit: 'kg', asOf: '2026-10-19', horizonDays: days },
      };
    },
    async tableOverview(query = {}) {
      return {
        items: [
          {
            id: '1'.repeat(24),
            name: 'Banana Ketchup',
            category: 'Pantry',
            unit: 'kg',
            currentStock: 15.0,
            avgDailyUsage: 1.25,
            forecastedDemand: 33.6,
            recommendedAction: 'Maintain Stock',
            riskLevel: 'Low',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    },
  };

  const app = createApp([], () => true, auth, undefined, undefined, dummyIngredientService, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, evaluationService);
  const http = createServer(app);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');

  const base = `http://127.0.0.1:${http.address().port}/api/ingredients`;
  const token = user => auth.issue(user).accessToken;
  const request = (user, path) => fetch(`${base}${path}`, {
    method: 'GET',
    headers: {
      ...(user ? { Authorization: `Bearer ${token(user)}` } : {}),
      'Content-Type': 'application/json',
    },
  });

  try {
    const validId = '1'.repeat(24);
    const missingId = '4'.repeat(24);

    // 1. Unauthenticated request rejected with 401
    assert.equal((await request(undefined, `/${validId}/forecast-accuracy`)).status, 401);
    assert.equal((await request(undefined, `/${validId}/forecast-vs-actual`)).status, 401);

    // 2. Inventory Staff rejected with 403 (RBAC)
    assert.equal((await request(staff, `/${validId}/forecast-accuracy`)).status, 403);
    assert.equal((await request(staff, `/${validId}/forecast-vs-actual`)).status, 403);

    // 3. Manager authorized (200)
    const accuracyRes = await request(manager, `/${validId}/forecast-accuracy`);
    assert.equal(accuracyRes.status, 200);
    const accuracyBody = await accuracyRes.json();
    assert.equal(accuracyBody.status, 'AVAILABLE');
    assert.equal(accuracyBody.metrics.accuracyScore, 88.0);

    const trendRes = await request(manager, `/${validId}/forecast-vs-actual?days=14`);
    assert.equal(trendRes.status, 200);
    const trendBody = await trendRes.json();
    assert.equal(trendBody.status, 'FOUND');
    assert.equal(trendBody.meta.horizonDays, 14);

    // 4. Admin authorized (200)
    assert.equal((await request(admin, `/${validId}/forecast-accuracy`)).status, 200);

    // 5. Missing ingredient returns 404
    assert.equal((await request(manager, `/${missingId}/forecast-accuracy`)).status, 404);
    assert.equal((await request(manager, `/${missingId}/forecast-vs-actual`)).status, 404);

    // 6. Invalid days parameter rejected with 400
    assert.equal((await request(manager, `/${validId}/forecast-vs-actual?days=999`)).status, 400);
    assert.equal((await request(manager, `/${validId}/forecast-vs-actual?days=invalid`)).status, 400);

    // 7. Overall forecast accuracy endpoint tests
    assert.equal((await request(undefined, '/forecast-accuracy')).status, 401);
    assert.equal((await request(staff, '/forecast-accuracy')).status, 403);
    const overallRes = await request(manager, '/forecast-accuracy');
    assert.equal(overallRes.status, 200);
    const overallBody = await overallRes.json();
    assert.equal(overallBody.status, 'AVAILABLE');
    assert.equal(overallBody.metrics.accuracyScore, 88.0);

    // 8. Forecast table endpoint tests
    assert.equal((await request(undefined, '/forecast-table')).status, 401);
    assert.equal((await request(staff, '/forecast-table')).status, 403);
    const tableRes = await request(manager, '/forecast-table?page=1&pageSize=10');
    assert.equal(tableRes.status, 200);
    const tableBody = await tableRes.json();
    assert.equal(tableBody.total, 1);
    assert.equal(tableBody.items[0].name, 'Banana Ketchup');
    assert.equal(tableBody.items[0].currentStock, 15.0);
  } finally {
    http.close();
  }
});

