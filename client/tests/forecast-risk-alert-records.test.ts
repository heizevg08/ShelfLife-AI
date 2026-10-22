import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastRiskAlertRecords } from '../src/utils/forecast-risk-alert-records';
import type { ForecastTableRow } from '../src/services/ingredients';

test('forecast risk alerts include only high and critical ingredients with actionable details', () => {
  const base: ForecastTableRow = {
    id: 'ingredient-1', name: 'Rice', category: 'Pantry', unit: 'kg', currentStock: 1.235,
    avgDailyUsage: 2, forecastedDemand: 40.246, recommendedAction: 'Reorder Stock', riskLevel: 'High',
  };
  const alerts = forecastRiskAlertRecords([
    base,
    { ...base, id: 'ingredient-2', riskLevel: 'Critical', currentStock: 0 },
    { ...base, id: 'ingredient-3', riskLevel: 'Medium' },
  ], '2026-10-22');

  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map(alert => alert.id), ['forecast-risk:ingredient-1', 'forecast-risk:ingredient-2']);
  assert.equal(alerts[0].date, '2026-10-22');
  assert.equal(alerts[0].priority, 'High');
  assert.match(alerts[0].details, /1\.24 kg on hand.*Reorder Stock.*40\.25 kg/);
});
