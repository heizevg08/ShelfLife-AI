import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/app/(administration)/Reports.tsx');
const manager = read('../src/components/application/ManagerReportsPage.tsx');
// Scope every assertion to the Admin branch: the same file also renders the Super Admin and
// Manager views, whose controls are out of scope for this pass.
const admin = page.slice(page.indexOf('function AdminReports()'), page.indexOf('function SuperAdminReports()'));
const downloadCenter = manager.slice(manager.indexOf('export function ManagementReportDownloadCenter'), manager.indexOf('export function useRecentReportDownloads'));
const recentDownloads = manager.slice(manager.indexOf('export function ManagementReportRecentDownloads'), manager.indexOf('export function ConnectedManagerReportsPage'));

test('the Admin Inventory Period Report and the Available Reports catalogue are removed in favour of the shared Download Center', () => {
  assert.ok(admin.length > 0);
  assert.doesNotMatch(admin, /Inventory Period Report|reports-period|listInventoryBatches|downloadInventoryPeriodXlsx|resolveAdminReportRange|periodSearch/);
  assert.doesNotMatch(admin, /Available Reports|sl-admin-report-records|Last Generated|reportPageSize|resetCatalogue|workspaceNavigation|Rows per page|unavailableMessage/);
  assert.match(admin, /<ManagementReportDownloadCenter options=\{adminReportOptions\} onExported=\{handleExported\} \/>/);
  assert.match(page, /import \{ ConnectedManagerReportsPage, ManagementReportDownloadCenter, ManagementReportRecentDownloads, adminReportOptions, useRecentReportDownloads \} from '\.\.\/\.\.\/components\/application\/ManagerReportsPage'/);
});

test('Admin renders the single shared download center with the Manager layout scope', () => {
  // The Manager layout tokens are scoped by `sl-manager-reports-live`, so the Admin instance keeps
  // the approved Manager spacing, control grid and responsive breakpoints instead of a restyled copy.
  assert.match(admin, /<div className="sl-manager-reports-live">\s*<ManagementReportDownloadCenter options=\{adminReportOptions\} onExported=\{handleExported\} \/>/);
  assert.match(downloadCenter, /<section className="sl-manager-operational-reports sl-manager-download-center" aria-labelledby="operational-reports-title">/);
  assert.match(downloadCenter, /<h2 id="operational-reports-title">Management Report Download Center<\/h2>/);
  assert.match(downloadCenter, /<span>Date Range<\/span><FilterSelect ariaLabel="Choose date range"/);
  assert.match(downloadCenter, /<span>Report<\/span><FilterSelect ariaLabel="Choose report"/);
  assert.match(downloadCenter, /<ExportControl available disabled=\{!range\} loading=\{exporting\} onExport=\{exportSelected\} \/>/);
  assert.match(downloadCenter, /onClick=\{resetDownloadCenter\}/);
  assert.match(downloadCenter, /downloadCombinedReport\(range\)/);
  assert.match(downloadCenter, /downloadReportXlsx\(selectedReport/);
  // One implementation only: the Manager page renders the same exported component.
  assert.match(manager, /<ManagementReportDownloadCenter onExported=\{handleExported\} \/>/);
  assert.match(manager, /await refreshRecentExports\(\)/);
});

test('Admin report KPIs stay truthful while Recent Downloads replaces the catalogue', () => {
  assert.match(admin, /getWasteSummary\(abort\.signal\)/);
  // The KPI scans as a compact peso value while the exact amount stays in its title.
  assert.match(admin, /formatCompactPeso\(wasteSummary\.totalWasteCostToday\)/);
  assert.match(admin, /formatExactPeso\(wasteSummary\.totalWasteCostToday\)/);
  assert.match(admin, /getInventoryBatchSummary\(abort\.signal\)/);
  assert.match(admin, /listIngredients\(1, 1, '', '', abort\.signal\)/);
  // The Manager standard Recent Downloads section is rendered for Admin with the same
  // xlsx history source and refresh wiring, not a catalogue placeholder.
  assert.match(admin, /<ManagementReportRecentDownloads recentExports=\{recentExports\} recentExportsError=\{recentExportsError\} \/>/);
  assert.match(admin, /void refreshRecentExports\(controller\.signal\)/);
  assert.match(recentDownloads, /<h2 id="recent-downloads-title">Recent downloads<\/h2>/);
  assert.match(manager, /result\.items\.filter\(item => item\.format === 'xlsx'\)\.slice\(0, 5\)/);
  // The only download control the Admin branch reaches is the live XLSX export of the center:
  // the unavailable catalogue ExportControl is gone from the Admin branch itself.
  assert.doesNotMatch(admin, /<ExportControl/);
  const exports = downloadCenter.match(/<ExportControl[^>]*\/>/g) ?? [];
  assert.equal(exports.length, 1);
  assert.match(exports[0], /\bavailable\b/);
  assert.doesNotMatch(exports[0], /unavailableMessage/);
});

test('Admin report filters offer only the reports the Admin role is authorized to download', () => {
  const authorized = manager.slice(manager.indexOf('export const adminReportOptions'), manager.indexOf('const reportOptions'));
  assert.equal((authorized.match(/value: '/g) ?? []).length, 4);
  for (const label of ['All reports', 'Inventory Summary', 'Usage & Consumption', 'Expiration & Waste']) assert.ok(authorized.includes(label), label);
  // The Manager list extends the authorized list, so the authorized set stays one source of truth.
  assert.match(manager, /\.\.\.adminReportOptions,/);
  assert.match(downloadCenter, /options = reportOptions/);
  assert.match(downloadCenter, /<span>Report<\/span><FilterSelect ariaLabel="Choose report" value=\{selectedReport\} options=\{options\}/);
  // Manager-only forecasting and AI categories never reach the Admin branch.
  assert.doesNotMatch(admin, /Demand Forecast|Forecast vs\. Actual|Forecast Accuracy|Expiration Risk|AI Insights & Recommendations/);
});
