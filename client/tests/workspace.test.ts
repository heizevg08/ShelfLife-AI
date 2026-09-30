import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canOpenWorkspacePath, canonicalWorkspaceAccess, dashboardPaths, workspaceNavigation, ingredientPermissions, type WorkspaceRole } from '../src/components/application/workspace';
import { administrationAreas } from '../src/components/application/administration';

const roles: WorkspaceRole[] = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];

test('every Source-of-Truth-derived role and canonical route decision is enforced', () => {
  let checked = 0;
  for (const [path, permitted] of Object.entries(canonicalWorkspaceAccess)) {
    for (const role of roles) {
      assert.equal(canOpenWorkspacePath(role, path), (permitted as readonly WorkspaceRole[]).includes(role), `${role} at ${path}`);
      checked += 1;
    }
  }
  assert.equal(Object.keys(canonicalWorkspaceAccess).length, 23);
  assert.equal(checked, 92);
  assert.deepEqual([...canonicalWorkspaceAccess['/AccountRequests']], roles);
  assert.equal(workspaceNavigation('Inventory Manager').some(item => item.path === '/AccountRequests'), true);
  assert.equal(workspaceNavigation('Inventory Staff').some(item => item.path === '/AccountRequests'), true);
  assert.equal(workspaceNavigation('Admin').some(item => item.path === '/AccountRequests'), true);
  assert.equal(workspaceNavigation('Super Admin').some(item => item.path === '/AccountRequests'), true);
  assert.equal(canOpenWorkspacePath('Inventory Staff', '/ChangeRequests'), true);
  assert.equal(workspaceNavigation('Inventory Staff').some(item => item.path === '/ChangeRequests'), true);
});

test('API-backed route permissions match the actual backend guards', () => {
  const ingredients = readFileSync(new URL('../../server/src/routes/ingredient.routes.ts', import.meta.url), 'utf8');
  const ingredientRequests = readFileSync(new URL('../../server/src/routes/ingredient-request.routes.ts', import.meta.url), 'utf8');
  const administration = readFileSync(new URL('../../server/src/routes/administration.routes.ts', import.meta.url), 'utf8');
  const rolesIn = (source: string, pattern: RegExp) => [...source.match(pattern)![1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual([...canonicalWorkspaceAccess['/Ingredients']], rolesIn(ingredients, /router.get\('\/', authorizeAdministration\((\[[^\]]+\])/));
  const writeRoles = (action: 'create' | 'update' | 'remove') => roles.filter(role => ingredientPermissions(role)[action]);
  assert.deepEqual(rolesIn(ingredients, /router.post\('\/', authorizeAdministration\((\[[^\]]+\])/), ['Inventory Manager', 'Inventory Staff']);
  assert.deepEqual(writeRoles('create'), ['Inventory Manager', 'Inventory Staff']);
  assert.deepEqual(rolesIn(ingredientRequests, /router.post\('\/', authorizeAdministration\((\[[^\]]+\])/), ['Inventory Staff']);
  assert.deepEqual(rolesIn(ingredientRequests, /router.patch\('\/:id\/review', authorizeAdministration\((\[[^\]]+\])/), ['Inventory Manager', 'Admin', 'Super Admin']);
  assert.deepEqual(writeRoles('update'), rolesIn(ingredients, /router.patch\('\/:id', authorizeAdministration\((\[[^\]]+\])/));
  assert.deepEqual(writeRoles('remove'), rolesIn(ingredients, /router.delete\('\/:id', authorizeAdministration\((\[[^\]]+\])/));
  assert.deepEqual([...canonicalWorkspaceAccess['/UserManagement']], rolesIn(administration, /router.use\('\/users', authorizeAdministration\((\[[^\]]+\])/));
  assert.deepEqual([...canonicalWorkspaceAccess['/AdministrativeAudit']], rolesIn(administration, /router.get\('\/audit-records', authorizeAdministration\((\[[^\]]+\])/));
  assert.deepEqual([...canonicalWorkspaceAccess['/SuperAdminDashboard']], rolesIn(administration, /router.use\('\/dashboard', authorizeAdministration\((\[[^\]]+\])/));
});

test('every visible navigation destination is permitted and unknown paths fail closed', () => {
  for (const role of roles) {
    assert.ok(canOpenWorkspacePath(role, dashboardPaths[role]));
    for (const item of workspaceNavigation(role)) assert.ok(canOpenWorkspacePath(role, item.path), `${role}: ${item.path}`);
    assert.equal(canOpenWorkspacePath(role, '/pages/unregistered'), false);
    assert.equal(canOpenWorkspacePath(role, '/made-up'), false);
  }
  const superAdminLinks = administrationAreas.filter(item => canOpenWorkspacePath('Super Admin', item.path));
  assert.equal(superAdminLinks.some(item => item.path === '/Ingredients'), true);
  assert.equal(workspaceNavigation('Inventory Staff').some(item => item.path === '/Alerts'), false);
  assert.equal(canOpenWorkspacePath('Admin', '/ExpirationMonitoring'), false);
});
