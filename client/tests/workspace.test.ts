import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canOpenWorkspacePath, canonicalWorkspaceAccess, type WorkspaceRole } from '../src/components/application/workspace';

const roles: WorkspaceRole[] = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'];

test('every Source-of-Truth-derived role and canonical route decision is enforced', () => {
  let checked = 0;
  for (const [path, permitted] of Object.entries(canonicalWorkspaceAccess)) {
    for (const role of roles) {
      assert.equal(canOpenWorkspacePath(role, path), (permitted as readonly WorkspaceRole[]).includes(role), `${role} at ${path}`);
      checked += 1;
    }
  }
  assert.equal(Object.keys(canonicalWorkspaceAccess).length, 29);
  assert.equal(checked, 116);
});

test('Manager Change Requests is selected inside the stable route outlet', () => {
  const layout = readFileSync('client/src/app/(administration)/_layout.tsx', 'utf8');
  const route = readFileSync('client/src/app/(administration)/ChangeRequests.tsx', 'utf8');
  assert.match(layout, /<ApplicationWorkspace><Slot\s*\/><\/ApplicationWorkspace>/);
  assert.doesNotMatch(layout, /usePathname|ConnectedManagerChangeRequestsPage/);
  assert.match(route, /user\.role === 'Manager' \? <ConnectedManagerChangeRequestsPage \/>/);
});

test('Manager Change Request presentation is opt-in and Staff modal keeps its protected semantic controls', () => {
  const details = readFileSync(new URL('../src/components/application/ChangeRequestDetailsDialog.tsx', import.meta.url), 'utf8');
  const manager = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  assert.match(details, /manager = false/);
  assert.match(manager, /<ChangeRequestDetailsDialog manager /);
  assert.match(route, /<ChangeRequestDetailsDialog request=\{detail\}/);
  assert.match(route, /<PageHeader eyebrow="Follow-up" title="My Requests"/);
  assert.match(route, /<InventoryStaffModal open=\{open\}/);
  assert.match(route, /<InventoryStaffModalForm formId="new-change-request"/);
  assert.match(route, /sl-staff-my-request-form-grid/);
  assert.match(route, /<span>Request Type<\/span><select/);
  assert.match(route, /<span>Ingredient<\/span><select/);
  assert.match(route, /<span>Current Value<\/span><output/);
  assert.match(route, /Requested Value'[\s\S]*?<input/);
  assert.match(route, /<span>Reason<\/span><textarea/);
  assert.match(route, /secondaryLabel="Cancel"/);
  assert.match(route, /primaryLabel="Submit Request"/);
  assert.match(route, /const DATE_RANGES=\['All dates','Today','Last 7 Days','Last 30 Days','Custom range'\]/);
  assert.match(route, /<span>Date range<\/span><select value=\{range\}/);
  assert.match(route, /range==='Custom range'&&<div className="sl-v219-custom-date-range">/);
  assert.match(route, /\.\.\.period,currentOnly:true/);
  assert.match(route, /const reset=\(\)=>\{setSearch\(''\);setType\(''\);setStatus\(''\);setRange\('All dates'\);setFrom\(''\);setTo\(''\);setPage\(1\)\}/);
  assert.match(route, /filtered\?'No matching records':'No requests yet'/);
  assert.match(route, /filtered\?'Try adjusting your search or filters\.':'Submitted requests will appear here\.'/);
  assert.match(route, /currentOnly:true/);
});
