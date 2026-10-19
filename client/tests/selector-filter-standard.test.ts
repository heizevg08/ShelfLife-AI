import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const app = (rel: string) => readFileSync(new URL(`../src/app/(administration)/${rel}`, import.meta.url), 'utf8');

const MODULE = read('components/application/ModulePage.tsx');
const ALERTS = app('Alerts.tsx');
const REPORTS = app('Reports.tsx');
const SECURITY = app('SecurityActivity.tsx');
const ACCOUNTS = read('components/application/AccountsTable.tsx');
const AUDIT = read('components/application/AuditTable.tsx');
const DATE_RANGE = read('components/application/DateRangeFilter.tsx');
const INV = read('components/application/ManagerInventoryPage.tsx');
const USAGE_WASTE = read('components/application/ManagerUsageWastePage.tsx');

// Confine each assertion to the record-filter toolbar, so the still-native page-size
// and form selects outside it can never make these tests pass by accident.
const toolbar = (source: string, startToken: string) => {
  const start = source.indexOf(startToken);
  assert.ok(start > -1, `toolbar marker "${startToken}" exists`);
  const endTwo = source.indexOf('</div></div>', start);
  const endPage = source.indexOf('Rows per page', start);
  const end = [endTwo, endPage].filter(value => value > start).reduce((nearest, value) => Math.min(nearest, value), Number.POSITIVE_INFINITY);
  assert.ok(end > start, `toolbar "${startToken}" has a bounded end`);
  return source.slice(start, end);
};

test('every applicable role filter toolbar uses the shared FilterSelect', () => {
  const staffStockIn = MODULE.slice(MODULE.indexOf('function InventoryStaffStockInPage'), MODULE.indexOf('function InventoryStaffInventoryBatchesPage'));
  assert.doesNotMatch(toolbar(staffStockIn, 'sl-staff-stockin-history-filters'), /<select/);

  // Manager
  assert.doesNotMatch(toolbar(INV, 'sl-application-records-toolbar'), /<select/);
  assert.doesNotMatch(toolbar(USAGE_WASTE, 'sl-application-records-toolbar'), /<select/);

  // Super Admin
  for (const marker of ['aria-label="Inventory batch filters"', 'aria-label="Usage filters"', 'aria-label="Waste filters"', 'aria-label="Change request filters"', 'aria-label="Expiration monitoring filters"', 'aria-label="Forecast filters"']) {
    const section = MODULE.slice(MODULE.indexOf(marker));
    const card = section.slice(0, section.indexOf('</div>'));
    assert.doesNotMatch(card, /<select/, `Super Admin card ${marker} has no native select`);
  }
  assert.doesNotMatch(toolbar(ALERTS, 'aria-label="Alert filters"'), /<select/);

  // Admin
  assert.doesNotMatch(toolbar(MODULE, 'aria-label="Ingredient filters"'), /<select/);
  assert.doesNotMatch(toolbar(MODULE, 'data-layout="inventory-admin"'), /<select/);
  assert.doesNotMatch(toolbar(AUDIT, 'sl-audit-filter-strip'), /<select/);
  assert.doesNotMatch(toolbar(ACCOUNTS, 'sl-user-accounts-filter-card'), /<select/);
  // Admin's report catalogue toolbar is gone: its report filter now lives in the shared
  // Download Center, scoped to the reports the Admin role may export.
  assert.doesNotMatch(REPORTS, /sl-admin-reports-filters|Filter reports by type/);
  assert.match(REPORTS, /<ManagementReportDownloadCenter options=\{adminReportOptions\} onExported=\{handleExported\} \/>/);
});

test('every converted filter keeps its label, options, order and default', () => {
  // Manager Inventory Overview
  assert.match(INV, /<span>Category<\/span><FilterSelect ariaLabel="Filter inventory by category"/);
  assert.match(INV, /<span>Stock Status<\/span><FilterSelect ariaLabel="Filter inventory by stock status"/);
  assert.match(INV, /<span>Expiration<\/span><FilterSelect ariaLabel="Filter inventory by expiration" value=\{expiration\} options=\{\['All','≤ 7 days','8–30 days','> 30 days'\]\.map/);

  // Manager Usage & Waste: the five labels in their approved order.
  assert.match(USAGE_WASTE, /<span>Date Range<\/span><FilterSelect ariaLabel="Filter usage and waste by date range" value=\{range\} options=\{\[\{value:'All dates',label:'All dates'\},\{value:'Today',label:'Today'\},\{value:'7 days',label:'7 days'\},\{value:'30 days',label:'30 days'\},\{value:'Custom range',label:'Custom range'\}\]\}/);
  assert.match(USAGE_WASTE, /<span>Ingredient Category<\/span><FilterSelect/);
  assert.match(USAGE_WASTE, /<span>Ingredient<\/span><FilterSelect/);
  assert.match(USAGE_WASTE, /setIngredientFilter\(''\)/);

  // Defaults are unchanged, except Manager Usage & Waste, whose analytics cards each
  // open on the current Philippine calendar week.
  assert.match(USAGE_WASTE, /const \[usagePeriod, setUsagePeriod\] = useState\('Weekly'\)/);
  assert.match(USAGE_WASTE, /const \[wastePeriod, setWastePeriod\] = useState\('Weekly'\)/);
  assert.match(INV, /useState\('All'\)/);
});

test('form fields and page-size selects stay native outside the filter toolbars', () => {
  // Page size is a control, not a filter: it must remain a native select.
  for (const [name, source] of [['ModulePage', MODULE], ['Alerts', ALERTS], ['AccountsTable', ACCOUNTS], ['AuditTable', AUDIT], ['ManagerInventoryPage', INV], ['ManagerUsageWastePage', USAGE_WASTE]] as const) {
    assert.match(source, /Rows per page[\s\S]{0,40}<select/, `${name} keeps its native page-size select`);
  }
  // SecurityActivity's own Audit Logs tab no longer hand-rolls a second table: it renders the
  // shared AuditTable, so the page-size select lives in AuditTable (asserted above) and must not
  // be reimplemented here. Reusing the one table keeps filtering, pagination and export in a
  // single place instead of drifting into two copies.
  // Single table, not two: extra opt-in props are tolerated, but the page must keep
  // delegating to the shared component with the audit overview configuration.
  assert.match(SECURITY, /<AuditTable adminOverview includeSuperAdminActors showSummary=\{false\}[^>]*\/>/);
  assert.doesNotMatch(SECURITY, /Rows per page/);
  // Transaction form fields keep native selects so the browser's own validity and
  // keyboard handling still apply inside the dialogs. The Manager recording dialogs ARE the
  // locked Inventory Staff bulk dialog, so those controls are asserted on that shared component.
  const BULK_MODAL = read('components/application/InventoryStaffBulkModal.tsx');
  assert.match(BULK_MODAL, /field\('ingredientId', 'Ingredient', <select value=\{row\.ingredientId\}/);
  assert.match(BULK_MODAL, /field\('batchId', 'Batch ID', <select value=\{row\.batchId\}/);
  assert.match(BULK_MODAL, /field\('reason', 'Reason', <select value=\{row\.reason\}/);
  assert.match(MODULE, /<span>Request Type<\/span><select/);
  assert.match(MODULE, /<span>Ingredient<\/span><select/);
  // The Manager page renders no recording form of its own: a second copy would drift.
  assert.equal(/<span>Batch ID<\/span><select/.test(USAGE_WASTE), false);
  assert.equal(/TransactionFields/.test(USAGE_WASTE), false);
});

test('the shared selector keeps its viewport-safe overlay and shared control styling', () => {
  const filterSelect = read('components/application/FilterSelect.tsx');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

  assert.match(filterSelect, /createPortal\(/);
  assert.match(filterSelect, /closest<HTMLElement>\('\.sl-app'\) \?\? document\.body/);
  assert.match(filterSelect, /role="combobox"/);
  assert.match(filterSelect, /role="listbox"/);
  assert.match(filterSelect, /aria-haspopup="listbox"/);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']) assert.ok(filterSelect.includes(`'${key}'`), key);

  // The trigger must keep matching the native control it replaced, so a converted
  // toolbar and a remaining native control still line up at every breakpoint.
  const trigger = styles.match(/\.sl-filter-select-trigger \{([\s\S]*?)\}/)?.[1].replace(/\s/g, '') ?? '';
  for (const declaration of ['height:40px', 'min-height:40px', 'border:1pxsolidvar(--sl-border)', 'border-radius:var(--sl-radius)', 'background:var(--sl-surface)', 'color:var(--sl-text)']) {
    assert.ok(trigger.includes(declaration), declaration);
  }
  assert.match(styles, /\.sl-filter-select \{ min-width:0; width:100%; \}/);
});

test('module-scoped table containment fixes are untouched by this standardization', () => {
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  // The previously approved Forecast, Inventory and Change Requests overrides stay in place.
  assert.match(styles, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table \{[^}]*min-width:\s*76rem/);
  assert.match(styles, /\.sl-manager-inventory-live \.sl-manager-inventory-directory \.sl-application-records-table \{[^}]*min-width:\s*58rem/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \{[^}]*min-width:\s*76rem/);
});
