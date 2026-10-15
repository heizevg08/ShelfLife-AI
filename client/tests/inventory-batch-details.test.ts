import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryBatchExpirationContext, inventoryBatchRequiresWaste } from '../src/components/application/InventoryBatchDetailsDialog';

test('Inventory Staff batch details derives expiration context and waste eligibility truthfully', () => {
  assert.equal(inventoryBatchExpirationContext(-2), '2 days ago');
  assert.equal(inventoryBatchExpirationContext(0), 'Expires today');
  assert.equal(inventoryBatchExpirationContext(4), 'in 4 days');
  assert.equal(inventoryBatchRequiresWaste({ displayStatus: 'In Stock', quantity: 4 }), false);
  assert.equal(inventoryBatchRequiresWaste({ displayStatus: 'Expired', quantity: 0 }), false);
  assert.equal(inventoryBatchRequiresWaste({ displayStatus: 'Expired', quantity: 0.9 }), true);
});

test('Inventory Staff batch details remains scoped and hands off to the existing Waste workflow', () => {
  const dialog = readFileSync(new URL('../src/components/application/InventoryBatchDetailsDialog.tsx', import.meta.url), 'utf8');
  const modulePage = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../src/components/application/InventoryStaffBulkModal.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(dialog, /batch\.displayStatus === 'Expired' && batch\.quantity > 0/);
  assert.match(dialog, /inventoryStaff && requiresWaste/);
  assert.match(dialog, /\(!inventoryStaff \|\| batch\.displayStatus !== 'Expired'\) && <Status/);
  assert.match(dialog, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.match(dialog, /onRecordWaste\(batch\)/);
  assert.match(modulePage, /<InventoryBatchDetailsDialog batch=\{viewBatch\} inventoryStaff/);
  assert.match(modulePage, /pathname:'\/WasteRecording',params:\{recordWaste:'1',ingredientId:batch\.ingredient\.id,batchId:batch\.id\}/);
  assert.match(modulePage, /initialSelection=\{handoff \? \{ ingredientId: params\.ingredientId!, batchId: params\.batchId! \}/);
  assert.match(modal, /blank\(initialIngredientId && initialBatchId \? \{ ingredientId: initialIngredientId, batchId: initialBatchId \}/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog\.sl-area-dialog/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-batch-details-secondary \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-batch-details-identity h3 \{[\s\S]*?font-size:1\.3125rem;[\s\S]*?font-weight:700;/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-batch-details-identity \.sl-canonical-identifier \{[\s\S]*?color:var\(--sl-text-muted\);[\s\S]*?font-size:\.8125rem;[\s\S]*?font-weight:400;/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-batch-details-identity \.sl-status \{[\s\S]*?padding:\.25rem \.55rem;[\s\S]*?font-size:\.75rem;/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-staff-batch-expired-warning strong \{ font-weight:700; \}/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \{ justify-content:flex-end; gap:10px; padding:12px 24px 14px; \}/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \.sl-button-danger \{[\s\S]*?background:var\(--sl-critical-bg\);[\s\S]*?color:var\(--sl-critical\);/);
});
