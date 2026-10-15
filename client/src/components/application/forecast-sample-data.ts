// Deterministic sample fixtures for the Manager Forecasting panel preview ONLY.
//
// WHY THESE ARE IN THEIR OWN FILE: the production Manager /Forecasting page renders the
// three approved panels with no data at all, and it must never be one import away from
// showing an invented number. Keeping the fixtures in this separate module means the
// production page imports types and helpers only - there is no path from the live route to
// any value below. Only the development-only preview page imports this file.
//
// Every name, Batch ID, unit, date and quantity here is invented and internally consistent
// on purpose. It is labelled SAMPLE DATA wherever it is rendered. It is not model output,
// not a historical record and not a forecast.
//
// noinspection JSUnusedGlobalSymbols - imported by the development-only preview page.

import type { CategoryDemandItem, ForecastInsight, ForecastPoint, ForecastSeriesMeta } from './forecast-chart-data';

export const FORECAST_SAMPLE_SERIES: ForecastSeriesMeta = {
  ingredient: 'Chicken Breast',
  unit: 'kg',
  asOf: '2026-10-13',
  horizonDays: 14,
};

// Fourteen business days. The shape is deliberate:
//   - 2026-10-06 has actual: null   -> the day was never recorded (gap in the actual line)
//   - 2026-10-09 has forecast: null -> no forecast was produced (gap in the forecast line)
//   - 2026-10-11 has a true zero actual -> a real baseline point must still be drawn,
//     which is exactly what tells the two apart: a zero is drawn, a gap is not.
export const FORECAST_SAMPLE_VS_ACTUAL: readonly ForecastPoint[] = [
  { date: '2026-10-01', forecast: 8.0, actual: 7.6 },
  { date: '2026-10-02', forecast: 8.2, actual: 8.9 },
  { date: '2026-10-03', forecast: 9.1, actual: 8.4 },
  { date: '2026-10-04', forecast: 7.4, actual: 7.1 },
  { date: '2026-10-05', forecast: 7.8, actual: 8.2 },
  { date: '2026-10-06', forecast: 8.6, actual: null },
  { date: '2026-10-07', forecast: 9.3, actual: 9.8 },
  { date: '2026-10-08', forecast: 9.0, actual: 8.7 },
  { date: '2026-10-09', forecast: null, actual: 8.1 },
  { date: '2026-10-10', forecast: 8.4, actual: 7.9 },
  { date: '2026-10-11', forecast: 7.2, actual: 0 },
  { date: '2026-10-12', forecast: 8.8, actual: 8.5 },
  { date: '2026-10-13', forecast: 9.4, actual: 9.1 },
  { date: '2026-10-14', forecast: 8.9, actual: 9.4 },
];

// Three units on purpose, so the unit separation is exercised rather than assumed: kg, L
// and pcs must each land in their own ranked group and can never be added together.
export const FORECAST_SAMPLE_CATEGORY_DEMAND: readonly CategoryDemandItem[] = [
  { category: 'Meat', unit: 'kg', value: 62.4, kind: 'historical' },
  { category: 'Meat', unit: 'kg', value: 71.8, kind: 'forecast' },
  { category: 'Produce', unit: 'kg', value: 48.1, kind: 'historical' },
  { category: 'Produce', unit: 'kg', value: 52.7, kind: 'forecast' },
  { category: 'Bakery', unit: 'kg', value: 21.3, kind: 'historical' },
  { category: 'Bakery', unit: 'kg', value: 19.6, kind: 'forecast' },
  { category: 'Dairy', unit: 'L', value: 34.9, kind: 'historical' },
  { category: 'Dairy', unit: 'L', value: 38.2, kind: 'forecast' },
  { category: 'Beverages', unit: 'L', value: 27.5, kind: 'historical' },
  { category: 'Beverages', unit: 'L', value: 30.1, kind: 'forecast' },
  { category: 'Pantry', unit: 'pcs', value: 940, kind: 'historical' },
  { category: 'Pantry', unit: 'pcs', value: 1015, kind: 'forecast' },
  { category: 'Frozen', unit: 'pcs', value: 320, kind: 'historical' },
  { category: 'Frozen', unit: 'pcs', value: 288, kind: 'forecast' },
];

// Worst first by declared tone, with the reason and the evidence in words. No card carries
// a risk score or a confidence figure, because no risk formula is approved.
export const FORECAST_SAMPLE_INSIGHTS: readonly ForecastInsight[] = [
  {
    id: 'sample-insight-1',
    ingredient: 'Chicken Breast',
    batchId: 'SL-20261004-002',
    reason: 'This batch expires sooner than the forecast uses it.',
    evidence: '10.0 kg left, expires in 4 days, forecast uses about 2.0 kg/day.',
    action: 'Use it first in the next two days, or plan a substitute dish.',
    tone: 'critical',
    potentialWasteQuantity: 2.0,
    unit: 'kg',
    potentialWasteCost: 480,
    expiresOn: '2026-10-18',
  },
  {
    id: 'sample-insight-2',
    ingredient: 'Fresh Milk',
    batchId: 'SL-20261009-004',
    reason: 'Forecast demand is below the quantity on hand before expiry.',
    evidence: '6.0 L left, expires in 6 days, forecast uses about 0.6 L/day.',
    action: 'Slow the next delivery or move it to a faster-selling use.',
    tone: 'attention',
    potentialWasteQuantity: 2.4,
    unit: 'L',
    potentialWasteCost: 216,
    expiresOn: '2026-10-20',
  },
  {
    id: 'sample-insight-3',
    ingredient: 'Baking Flour',
    batchId: 'SL-20260928-001',
    reason: 'Stock is short of the forecast for the coming period.',
    evidence: '12.0 kg on hand, forecast needs about 19.6 kg over the next 14 days.',
    action: 'Review whether a purchase is needed before the period ends.',
    tone: 'neutral',
  },
];
