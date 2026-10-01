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
