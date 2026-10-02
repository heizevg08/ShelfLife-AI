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
  assert.match(staff, /View your submitted change request and its review status\./);
  assert.doesNotMatch(staff, /Submitted By/);
  assert.match(staff, /statusLabel\(request\.status\)/);
  assert.match(staff, /Awaiting manager review/);
  assert.match(staff, /request\.status !== 'PENDING' && Boolean\(request\.reviewedBy \|\| request\.reviewedAt \|\| request\.reviewNote\)/);
  assert.match(staff, /request\.reviewedBy\.name/);
  assert.match(source, /managerRows=request\?/);
  assert.match(source, /subtitle="Review the submitted master-data change and decision\."/);
});

test('My Requests keeps its protected create modal, date range, and current-only query', () => {
  const source = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(source, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.match(source, /description="Submit and track your ingredient change requests\."/);
  assert.match(source, /placeholder="Search by request ID or ingredient\.\.\."/);
  assert.doesNotMatch(source, /Search by request ID, ingredient, or batch ID/);
  assert.match(source, /\['Request ID','Ingredient','Requested Change','Submitted On','Status'\]/);
  assert.doesNotMatch(source, /\['Request ID','Type','Ingredient'/);
  assert.match(source, /const requestedChange=.*formatStaffChangeRequestValue\(record,record\.currentValue\).*→.*formatStaffChangeRequestValue\(record,record\.requestedValue\)/);
  assert.match(source, /\[FileInput,'brand','Total Requests'/);
  assert.match(source, /\[Clock3,'attention','Pending'/);
  assert.match(source, /\[CheckCircle2,'success','Approved'/);
  assert.match(source, /\[XCircle,'critical','Rejected'/);
  assert.doesNotMatch(source, />Pending Review</);
  assert.match(source, /getChangeRequestSummary\(signal\)/);
  assert.match(source, /summaryFailed\|\|summary===null\?'—':value/);
  assert.doesNotMatch(source, /items\.reduce/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table :is\(th,td\) \{ text-align:left!important; \}/);
  assert.match(styles, /\.sl-staff-change-request-details \.sl-status-dot \{ display:none; \}/);
  assert.match(source, /<span>Date Range<\/span>/);
  assert.match(source, /currentOnly:true/);
  assert.match(source, /<span>Request Type<\/span><select/);
  assert.match(source, /<span>Ingredient<\/span><select/);
  assert.match(source, /<span>Current Value<\/span><output/);
  assert.match(source, /Requested Value'[\s\S]*?<input/);
  assert.match(source, /<span>Reason<\/span><textarea/);
  assert.match(source, /secondaryLabel="Cancel"/);
  assert.match(source, /primaryLabel="Submit Request"/);
});
