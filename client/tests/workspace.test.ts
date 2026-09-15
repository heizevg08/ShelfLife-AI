import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(Object.keys(canonicalWorkspaceAccess).length, 21);
  assert.equal(checked, 84);
});
