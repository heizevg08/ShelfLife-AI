import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ChangeRequest } from '../src/services/change-requests';
import { formatStaffChangeRequestValue } from '../src/utils/change-request-format';

const request = (overrides: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: 'request-id',
  requestID: 'REQ-20261002-001',
  requestType: 'MINIMUM_STOCK_CHANGE',
  targetField: 'minimumStock',
  reason: 'Incorrect min. stock',
  currentValue: '57',
  requestedValue: '80',
  ingredient: { id: 'ingredient-id', name: 'Chicken Breast', unitOfMeasure: 'kg' },
  status: 'PENDING',
  requestedBy: { id: 'staff-id', name: 'Development InventoryStaff' },
  createdAt: '2026-10-02T00:42:00.000Z',
  updatedAt: '2026-10-02T00:42:00.000Z',
  ...overrides,
});

test('Inventory Staff change values use authoritative type-aware formatting', () => {
  const minimumStock = request();
  assert.equal(formatStaffChangeRequestValue(minimumStock, minimumStock.currentValue), '57 kg');
  assert.equal(formatStaffChangeRequestValue(minimumStock, minimumStock.requestedValue), '80 kg');
  const cost = request({ requestType: 'STANDARD_UNIT_COST_CHANGE', targetField: 'standardUnitCost' });
  assert.equal(formatStaffChangeRequestValue(cost, '100'), '₱100.00');
  const shelfLife = request({ requestType: 'DEFAULT_SHELF_LIFE_CHANGE', targetField: 'defaultShelfLifeDays' });
  assert.equal(formatStaffChangeRequestValue(shelfLife, '1'), '1 day');
  assert.equal(formatStaffChangeRequestValue(shelfLife, '30'), '30 days');
});

test('Inventory Staff details are role-specific while Manager presentation remains intact', () => {
  const source = readFileSync(new URL('../src/components/application/ChangeRequestDetailsDialog.tsx', import.meta.url), 'utf8');
  const staffStart = source.indexOf('function InventoryStaffChangeRequestDetails');
  const staffEnd = source.indexOf('export function ChangeRequestDetailsDialog');
  const staff = source.slice(staffStart, staffEnd);
  assert.match(staff, /View your submitted request\./);
  assert.doesNotMatch(staff, /Request Information|Submitted By|Reviewed By/);
  assert.doesNotMatch(staff, /<dt>Request ID|<dt>Submitted|<dt>Ingredient|<dt>Status/);
  assert.match(staff, /formatHumanReadableText\(request\.ingredient\.name\)/);
  assert.match(staff, /request\.requestID/);
  assert.match(staff, /formatDateTime\(request\.createdAt\)/);
  assert.match(staff, /changeRequestStatusLabel\(request\.status\)/);
  assert.match(staff, />Current</);
  assert.match(staff, />Requested</);
  assert.match(staff, /<div><strong>\{current\}<\/strong><span>Current<\/span><\/div>/);
  assert.match(staff, /className="sl-staff-change-request-requested"/);
  assert.match(staff, /<p>\{request\.reason\}<\/p>/);
  assert.doesNotMatch(staff, /Awaiting manager review/);
  assert.match(staff, /request\.status !== 'PENDING' && request\.reviewedAt/);
  assert.match(staff, /formatDateTime\(request\.reviewedAt\)/);
  assert.match(staff, /request\.status !== 'PENDING' && request\.reviewNote\?\.trim\(\)/);
  assert.match(staff, /Manager Note/);
  assert.doesNotMatch(staff, /reviewedBy/);
  assert.doesNotMatch(staff, /Edit|Delete|Approve|Reject/);
  assert.doesNotMatch(staff, /Chicken Breast|₱555|₱67|57 kg|80 kg/);
  assert.match(staff, /sl-staff-my-requests-change-request-details-dialog/);
  assert.doesNotMatch(staff, /sl-admin-ingredient-dialog|sl-ingredient-view-dialog/);
  assert.match(source, /managerRows=request\?/);
  assert.match(source, /subtitle="Review the submitted master-data change and decision\."/);
});

test('My Requests keeps its protected create modal, date range, and current-only query', () => {
  const source = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(source, /<ChangeRequestDetailsDialog inventoryStaff inventoryStaffMyRequests request=\{detail\}/);
  assert.match(source, /description="Submit and track your ingredient change requests\."/);
  assert.match(source, /placeholder="Search by request ID or ingredient\.\.\."/);
  assert.doesNotMatch(source, /Search by request ID, ingredient, or batch ID/);
  assert.match(source, /\['Request ID','Ingredient','Requested Change','Submitted On','Status'\]/);
  assert.doesNotMatch(source, /\['Request ID','Type','Ingredient'/);
  assert.match(source, /const requestedChange=\(record:ChangeRequest\)=>changeRequestTypeLabel\(record\.requestType\)/);
  assert.match(source, /\[FileInput,'brand','Total Requests'/);
  assert.match(source, /\[Clock3,'info','Pending'/);
  assert.match(source, /\[CheckCircle2,'attention','Approved'/);
  assert.match(source, /\[XCircle,'critical','Rejected'/);
  assert.match(source, /<div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201">/);
  assert.doesNotMatch(styles, /\.sl-staff-requests-v162 \.sl-staff-usage-kpis \.sl-inventory-staff-kpi \{/);
  assert.doesNotMatch(source, />Pending Review</);
  assert.match(source, /getChangeRequestSummary\(signal\)/);
  assert.match(source, /summaryFailed\|\|summary===null\?'—':value/);
  assert.doesNotMatch(source, /items\.reduce/);
  assert.match(source, /<colgroup><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-change"\/><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-status"\/><\/colgroup>/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table :is\(thead th,tbody td\) \{ text-align:left!important; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-standard \{ width:20%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-change \{ width:30%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-status \{ width:10%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-canonical-identifier \{ font-weight:600; \}/);
  assert.match(styles, /\.sl-staff-change-request-details \.sl-status-dot \{ display:none; \}/);
  assert.match(styles, /\.sl-area-dialog\.sl-staff-my-requests-change-request-details-dialog \{\s*width:min\(38rem,calc\(100vw - 2rem\)\)!important;\s*max-width:38rem!important;/);
  assert.match(styles, /\.sl-staff-change-request-comparison \{[\s\S]*?background:var\(--sl-surface-subtle\);[\s\S]*?\}/);
  assert.doesNotMatch(styles, /\.sl-staff-my-requests-change-request-details-dialog \.sl-staff-change-request-comparison > \.sl-staff-change-request-requested \{/);
  assert.doesNotMatch(styles, /\.sl-staff-my-requests-change-request-details-dialog[^{}]*\.sl-staff-change-request-requested[^{}]*\{[^}]*?(?:background|border|outline|box-shadow|gradient):/);
  assert.match(styles, /\.sl-staff-my-requests-change-request-details-dialog \.sl-staff-change-request-requested > strong \{ color:var\(--sl-success\); \}/);
  assert.match(styles, /\.sl-staff-change-request-comparison > div > span \{ color:var\(--sl-muted\);/);
  assert.doesNotMatch(styles, /\.sl-staff-my-requests-change-request-details-dialog[^{}]*\.sl-staff-change-request-requested > span \{/);
  assert.doesNotMatch(styles, /\.sl-staff-my-requests-change-request-details-dialog[^{}]*first-child[^{}]*strong[^{}]*\{[^}]*color:/);
  assert.match(styles, /@media \(width<=540px\) \{[\s\S]*?\.sl-area-dialog:is\(\.sl-staff-change-request-details-dialog,\.sl-staff-my-requests-change-request-details-dialog\) \{ width:calc\(100vw - 1rem\)!important; max-width:calc\(100vw - 1rem\)!important; \}/);
  assert.match(styles, /\.sl-staff-change-request-content \{ margin-top:14px; \}/);
  assert.match(styles, /\.sl-staff-change-request-reason \{ margin-top:14px; \}/);
  assert.match(styles, /\.sl-staff-change-request-outcome \{ margin:12px 0 0;/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \{ table-layout:fixed; min-width:58rem; \}/);
  assert.match(source, /<span>Date Range<\/span>/);
  assert.match(source, /currentOnly:true/);
  assert.match(source, /const PAGE_SIZES=\[10,15,50,100,150\]/);
  assert.match(source, /itemLabel=\{total===1\?'request':'requests'\}/);
  assert.match(source, /className="sl-detail-enabled-row" tabIndex=\{0\}/);
  const recordsHeader = source.slice(source.indexOf('<header className="sl-application-records-header'), source.indexOf('</header>', source.indexOf('<header className="sl-application-records-header')));
  const toolbar = source.slice(source.indexOf('<div className="sl-sa-ingredients-table-filters">'), source.indexOf('<div className="sl-sa-ingredients-table-scroll'));
  assert.match(recordsHeader, /<h2>Requests<\/h2>/);
  assert.doesNotMatch(recordsHeader, />New Request</);
  assert.match(toolbar, />New Request</);
  assert.ok(toolbar.indexOf('Search records') < toolbar.indexOf('<span>Type</span>'));
  assert.ok(toolbar.indexOf('<span>Type</span>') < toolbar.indexOf('<span>Status</span>'));
  assert.ok(toolbar.indexOf('<span>Status</span>') < toolbar.indexOf('<span>Date Range</span>'));
  assert.ok(toolbar.indexOf('<span>Date Range</span>') < toolbar.indexOf('>Clear filters</button>'));
  assert.ok(toolbar.indexOf('>Clear filters</button>') < toolbar.indexOf('>New Request</button>'));
  assert.match(toolbar, /\{filtered&&<button[^>]*>Clear filters<\/button>\}/);
  assert.doesNotMatch(toolbar, />Reset<\/button>/);
  assert.match(source, /<span>Request Type<\/span><select/);
  assert.match(source, /<span>Ingredient<\/span><select/);
  assert.match(source, /<span>Current Value<\/span><output/);
  assert.match(source, /Requested Value'[\s\S]*?<input/);
  assert.match(source, /<span>Reason<\/span><textarea/);
  assert.match(source, /secondaryLabel="Cancel"/);
  assert.match(source, /primaryLabel="Submit Request"/);
});

test('Inventory Staff dashboard and My Requests share the same Staff details path', () => {
  const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
  const myRequests = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const manager = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.match(myRequests, /<ChangeRequestDetailsDialog inventoryStaff inventoryStaffMyRequests request=\{detail\}/);
  assert.match(dashboard, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.doesNotMatch(dashboard, /inventoryStaffMyRequests/);
  assert.match(manager, /<ChangeRequestDetailsDialog manager request=\{selected\}/);
});
