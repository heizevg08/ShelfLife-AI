import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
const accounts = readFileSync(new URL('../src/components/application/AccountsTable.tsx', import.meta.url), 'utf8');
const modules = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('Admin core data routes retain the shared Back to Top control', () => {
  for (const route of ['/UserManagement', '/Ingredients', '/InventoryBatches', '/AdministrativeAudit']) {
    assert.ok(shell.includes(`'${route}'`));
  }
  assert.match(shell, /showBackToTop \|\| backToTopAlwaysAvailable/);
  assert.match(shell, /appRef\.current\?\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(shell, /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(shell, /getElementById\('sl-main'\)\?\.focus\(\{ preventScroll: true \}\)/);
});

test('all role tables inherit the Super Admin action-button contract', () => {
  assert.match(css, /width: 36px;[\s\S]*height: 36px;[\s\S]*border-radius: 8px;/);
  assert.match(css, /\.sl-icon-button > svg \{[\s\S]*width: 16px;[\s\S]*height: 16px;/);
  assert.match(css, /\.sl-icon-button:hover:not\(:disabled\)/);
  assert.match(css, /\.sl-icon-button:focus-visible/);
  assert.doesNotMatch(accounts, /sl-account-action-(?:view|edit|deactivate|reactivate)/);
  const adminIngredients = modules.slice(modules.indexOf('function IngredientsAdminPage'), modules.indexOf('function SuperAdminIngredientsPage'));
  const inventoryAdminStart = modules.indexOf("if (moduleId === 'InventoryBatches' && user.role === 'Admin')");
  const adminInventory = modules.slice(inventoryAdminStart, modules.indexOf("if (moduleId === 'Roles')", inventoryAdminStart));
  assert.ok(adminIngredients.length > 0, 'Admin Ingredients section anchor must resolve');
  assert.ok(inventoryAdminStart > -1 && adminInventory.length > 0, 'Admin Inventory section anchor must resolve');
  assert.doesNotMatch(adminIngredients, /sl-account-action-(?:view|edit|deactivate|reactivate)/);
  assert.doesNotMatch(adminInventory, /sl-account-action-(?:view|edit|deactivate|reactivate)/);
});

test('Admin account lifecycle cancellation closes to the list without navigation or mutation', () => {
  assert.match(accounts, /function close\(\) \{[\s\S]*setMode\(null\);[\s\S]*setSelected\(null\);[\s\S]*\}/);
  assert.match(accounts, /open=\{mode === 'lifecycle'\}[\s\S]*onDismiss=\{close\}[\s\S]*<button className="sl-button sl-logout-stay" data-initial-focus disabled=\{busy\} onClick=\{close\}>Cancel<\/button>/);
  const cancelStart = accounts.indexOf('>Cancel</button>');
  const cancelHandler = accounts.slice(Math.max(0, cancelStart - 180), cancelStart + 16);
  assert.ok(cancelStart > -1, 'lifecycle Cancel button anchor must resolve');
  assert.doesNotMatch(accounts, /dismissLifecycle/);
  assert.doesNotMatch(cancelHandler, /router\.push|navigate\(|setAccountActive|lifecycle\}/);
});

test('Admin account lifecycle confirmations share the canonical responsive dialog structure', () => {
  assert.match(accounts, /className=\{`sl-logout-dialog sl-account-lifecycle-dialog\$\{selected\?\.isActive \? ' is-destructive' : ' is-positive'\}`\}/);
  assert.match(accounts, /title=\{<div className="sl-confirmation-layout"><span className="sl-logout-icon"[\s\S]*selected\?\.isActive \? <UserX size=\{20\} \/> : <UserCheck size=\{20\} \/>/);
  assert.match(accounts, /<h2 className="sl-section-title">/);
  assert.match(accounts, /Historical records will be preserved\./);
  assert.match(accounts, /onClick=\{lifecycle\}>\{busy \? 'Saving…' : selected\?\.isActive \? 'Deactivate account' : 'Reactivate account'\}/);
  // The current shared Dialog structure uses natural content height and
  // semantic success styling rather than artificial minimum-height reserves.
  assert.doesNotMatch(css, /\.sl-account-lifecycle-dialog \.sl-confirmation-copy \.sl-description \{\s*min-height:/);
  assert.match(css, /\.sl-account-lifecycle-dialog\.is-positive \.sl-logout-icon \{\s*color: var\(--sl-success\);[\s\S]*?background: var\(--sl-success-bg\);/);
});
