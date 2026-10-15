import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const modulePage = read('../src/components/application/ModulePage.tsx');
const requests = read('../src/app/(administration)/ChangeRequests.tsx');
const dashboard = read('../src/components/dashboard/RoleDashboard.tsx');
const styles = read('../src/styles/application.css');

test('Inventory Staff shrink boundaries and table overflow stay at page/card and immediate table shells', () => {
  assert.match(styles, /\.sl-staff-my-requests \{[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.sl-staff-my-requests-records \{[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.sl-staff-inventory-v149 \.sl-staff-inventory-main \{ min-width:0; \}/);
  assert.match(styles, /\.sl-inventory-staff-preview-grid > :is\([^)]+\) \{[\s\S]*?min-width:0;/);
  assert.match(styles, /\.sl-inventory-staff-dashboard-v140 \.sl-inventory-staff-preview-grid[\s\S]*?overflow-x:auto; overflow-y:hidden;/);
  assert.match(styles, /\.sl-area-dialog\.sl-inventory-staff-bulk-dialog > \.sl-dialog-content \{[\s\S]*?overflow-x:hidden;/);
});

test('record tables preserve readable minimum widths inside their local scroll wrappers', () => {
  for (const wrapper of ['sl-staff-usage-table-shell', 'sl-staff-waste-table-shell', 'sl-sa-ingredients-table-scroll']) {
    assert.ok(modulePage.includes(wrapper) || requests.includes(wrapper), wrapper);
  }
  assert.match(styles, /\.sl-staff-my-requests-table \{ table-layout:fixed; min-width:58rem; \}/);
  assert.match(styles, /\.sl-inventory-staff-fefo-table \.sl-dashboard-source-table \{ min-width:42rem; \}/);
  assert.doesNotMatch(styles, /\.sl-shell\s*\{[^}]*overflow-x:auto/);
  assert.doesNotMatch(styles, /\.sl-main\s*\{[^}]*overflow-x:auto/);
});

test('toolbar field order and Custom Range ownership remain module-controlled', () => {
  const stock = modulePage.slice(modulePage.indexOf('function InventoryStaffStockInPage'), modulePage.indexOf('function InventoryStaffInventoryBatchesPage'));
  const usage = modulePage.slice(modulePage.indexOf('function InventoryStaffUsagePage'), modulePage.indexOf('const inventoryBatchStatusTone'));
  const waste = modulePage.slice(modulePage.indexOf('function InventoryStaffWastePage'), modulePage.indexOf('function ManagerUsageWastePage'));

  assert.ok(stock.indexOf('Search records') < stock.indexOf('ariaLabel="Ingredient"'));
  assert.ok(stock.indexOf('ariaLabel="Ingredient"') < stock.indexOf('Filter Stock-In by date range'));
  assert.ok(usage.indexOf('Search records') < usage.indexOf('Filter by ingredient'));
  assert.ok(usage.indexOf('Filter by ingredient') < usage.indexOf('Filter by date range'));
  assert.ok(waste.indexOf('Search records') < waste.indexOf('Filter by waste reason'));
  assert.ok(waste.indexOf('Filter by waste reason') < waste.indexOf('Filter waste by date range'));
  assert.match(requests, /Search records[\s\S]*?<span>Type<\/span>[\s\S]*?<span>Status<\/span>[\s\S]*?<span>Date Range<\/span>/);
  for (const source of [stock, usage, waste, requests]) {
    assert.match(source, /sl-v219-custom-date-range/);
    assert.match(source, /<span>From<\/span><input type="date"[\s\S]*?<span>To<\/span><input type="date"/);
  }
});

test('KPI labels and dashboard operational table order remain stable', () => {
  assert.match(dashboard, /Today&apos;s Usage[\s\S]*?Total Batches[\s\S]*?Expiring Soon[\s\S]*?Low Stock/);
  assert.match(dashboard, /\['#','Ingredient','Batch ID','Expiration Date','Days Left'\]/);
  assert.match(dashboard, /\['Request ID','Requested Change','Submitted On','Status'\]/);
  assert.match(modulePage, /Total Batches[\s\S]*?Near Expiry[\s\S]*?Expired[\s\S]*?Low Stock/);
});

test('Inventory Staff responsive ownership follows usable module and records container widths', () => {
  assert.match(styles, /\.sl-shell \{[\s\S]*?--sl-sidebar-width: 15\.5rem;/);
  assert.match(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-inventory-staff-dashboard-v140,[^}]+\) \{\s*container-name:sl-inventory-staff-page;\s*container-type:inline-size;/);
  assert.match(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-application-records,\.sl-sa-account-pattern-records\) \{\s*container-name:sl-inventory-staff-records;\s*container-type:inline-size;/);
  assert.match(styles, /@container sl-inventory-staff-page \(max-width:99rem\)[\s\S]*?\.sl-inventory-staff-preview-grid \{\s*grid-template-columns:minmax\(0,1fr\);/);
  assert.doesNotMatch(styles, /@media \(width<=1100px\) \{\s*\.sl-inventory-staff-dashboard-v140 \.sl-inventory-staff-preview-grid/);
  assert.match(styles, /@container sl-inventory-staff-page \(max-width:75rem\)[\s\S]*?\.sl-shell\[data-role="Inventory Staff"\][^{}]+\.sl-superadmin-dashboard-kpis-v201\.sl-staff-usage-kpis[^{}]+\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(styles, /@container sl-inventory-staff-page \(max-width:40rem\)[\s\S]*?\.sl-shell\[data-role="Inventory Staff"\][^{}]+\{ grid-template-columns:minmax\(0,1fr\);/);
  assert.match(styles, /@container sl-inventory-staff-records \(max-width:64rem\)[\s\S]*?\.sl-shell\[data-role="Inventory Staff"\][^{}]+\.sl-sa-account-pattern-records[^{}]+\{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/);
  assert.match(styles, /@container sl-inventory-staff-records \(max-width:48rem\)[\s\S]*?\.sl-shell\[data-role="Inventory Staff"\][^{}]+\.sl-sa-account-pattern-records[^{}]+\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); display:grid; \}/);
  assert.match(styles, /@container sl-inventory-staff-records \(max-width:36rem\)[\s\S]*?\.sl-shell\[data-role="Inventory Staff"\][^{}]+\.sl-sa-account-pattern-records[^{}]+\{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(styles, /@container sl-inventory-staff-page \(max-width:48rem\) \{[\s\S]*?\.sl-inventory-staff-quick-actions \{ align-items:stretch; flex-direction:column; \}/);
  assert.doesNotMatch(styles, /@media \(width<=620px\) \{[\s\S]*?\.sl-inventory-staff-quick-actions/);
  assert.doesNotMatch(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-workspace,\.sl-main\)[^}]*container-type/);
  assert.doesNotMatch(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-workspace,\.sl-main\)[^}]*overflow-x:clip/);
  assert.doesNotMatch(styles, /@media \(resolution>=1\.25x\)\{\s*\.sl-staff-inventory-v149/);
});
