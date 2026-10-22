import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/components/application/ManagerReportsPage.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/report-exports.ts', import.meta.url), 'utf8');
const primitives = readFileSync(new URL('../src/components/application/primitives.tsx', import.meta.url), 'utf8');

test('Manager uses authorized sources for all four KPIs, including overall forecast accuracy', () => {
  const labels = ['Inventory Value', 'Near-Expiry Batches', 'Estimated Waste Cost', 'Forecast Accuracy'];
  let cursor = -1;
  for (const label of labels) { const next = page.indexOf(`<span>${label}</span>`); assert.ok(next > cursor); cursor = next; }
  assert.match(page, /getInventoryBatchSummary\(controller\.signal\)/);
  assert.match(page, /getWasteSummary\(controller\.signal\)/);
  assert.match(page, /getGeneralForecastAccuracy\(controller\.signal\)/);
  assert.match(page, /accuracy\.metrics\.accuracyScore/);
  assert.match(page, /accuracy\.evaluatedDays\}\/\{accuracy\.minimumRequiredDays\} days evaluated/);
});

test('Download Center offers one shared XLSX action and no CSV service', () => {
  assert.match(page, /Management Report Download Center/);
  assert.match(page, /Date Range/);
  assert.match(page, /<ExportControl available disabled=\{!range\} loading=\{exporting\} onExport=\{exportSelected\} \/>/);
  assert.match(primitives, /Download \(XLSX\)/);
  assert.match(page, /All reports/);
  assert.match(page, /Choose report/);
  assert.match(page, /Reset/);
  for (const report of ['Inventory Summary', 'Usage & Consumption', 'Expiration & Waste']) assert.ok(page.includes(report));
  assert.doesNotMatch(page, /Download Combined XLSX|Download Selected XLSX|Download CSV|Individual CSV report|Download current inventory and recorded usage and waste in one Excel file\.|Inventory is a current snapshot when the file is prepared\. The selected Philippine dates apply to usage and waste\.|getReportPreview|managerReportPreview|sl-manager-report-card|sl-manager-preview-section|sl-manager-download-badge|Recent Exports/);
  assert.match(page, /Recent downloads/);
  assert.match(page, /getMyRecentExports/);
  assert.match(service, /downloadCombinedReport/);
  assert.match(service, /downloadReportXlsx/);
  assert.match(page, /await refreshRecentExports\(\)/);
  assert.doesNotMatch(service, /downloadReport\(/);
  assert.doesNotMatch(service, /export\.csv|\.csv/);
});

test('Report filter exposes approved forecasting and intelligence reports as active options for Manager', () => {
  for (const [value, label] of [
    ['demand-forecast', 'Demand Forecast'],
    ['forecast-vs-actual', 'Forecast vs. Actual'],
    ['forecast-accuracy', 'Forecast Accuracy'],
    ['expiration-risk', 'Expiration Risk'],
    ['ai-insights-recommendations', 'AI Insights & Recommendations'],
  ]) {
    assert.ok(page.includes(`{ value: '${value}', label: '${label}' }`));
    assert.ok(!page.includes(`{ value: '${value}', label: '${label}', disabled: true }`));
  }
  assert.match(page, /type ReportSelection = OperationalReportId \| 'all'/);
});
