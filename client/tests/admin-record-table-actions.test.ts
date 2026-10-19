import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('Admin Ingredients preserves bounded values and uses canonical row actions', () => {
  const page = source.slice(source.indexOf('function IngredientsAdminPage'), source.indexOf('function SuperAdminIngredientsPage'));

  assert.match(page, /className="sl-application-row-actions-cell"><div className="sl-staff-waste-row-actions" aria-label=\{`Actions for \$\{item\.name\}`\}>/);
  assert.match(page, /className="sl-icon-button" aria-label=\{`View \$\{item\.name\}`\} title="View"[\s\S]*?<Eye size=\{16\}/);
  assert.match(page, /className="sl-icon-button" aria-label=\{`Edit \$\{item\.name\}`\} title="Edit"[\s\S]*?<Pencil size=\{16\}/);
  assert.match(page, /className="sl-icon-button sl-staff-waste-delete" aria-label=\{`Delete \$\{item\.name\}`\} title="Delete"[\s\S]*?<Trash2 size=\{16\}/);
  assert.doesNotMatch(page, /sl-account-action-(?:view|edit|deactivate|reactivate)/);
  assert.match(styles, /:is\(\.sl-admin-ingredient-records,\.sl-admin-inventory-records\) \.sl-application-records-table tbody td:not\(\.sl-application-row-actions-cell\) \{[\s\S]*?text-overflow: clip;[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(styles, /\.sl-admin-ingredient-records \.sl-admin-ingredient-name \{[\s\S]*?text-overflow: clip;[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere;/);
});

test('Admin Inventory Batches aligns its supported view action with canonical rows', () => {
  const start = source.indexOf("if (moduleId === 'InventoryBatches' && user.role === 'Admin')");
  const page = source.slice(start, source.indexOf("if (moduleId === 'Roles')", start));

  assert.match(page, /className="sl-application-row-actions-cell"><div className="sl-staff-waste-row-actions" aria-label=\{`Actions for batch \$\{batch\.batchID\}`\}>/);
  assert.match(page, /className="sl-icon-button" aria-label=\{`View batch \$\{batch\.batchID\}`\} title="View"[\s\S]*?<Eye size=\{16\}/);
  assert.doesNotMatch(page, /aria-label=\{`(?:Edit|Delete) batch/);
  assert.doesNotMatch(page, /sl-account-action-(?:view|edit|deactivate|reactivate)/);
});
