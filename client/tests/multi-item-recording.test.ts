import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Inventory Staff recording forms share one repeatable row implementation and one bulk request per submit', () => {
  const form = readFileSync(new URL('../src/components/application/InventoryStaffBulkModal.tsx', import.meta.url), 'utf8');
  const modulePage = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  assert.match(form, /useState<Draft\[]>\(\[blank\(\)\]\)/);
  assert.match(form, /key=\{row\.key\}/);
  assert.match(form, /Add Item/);
  assert.match(form, /Remove item \$\{index \+ 1\}/);
  assert.match(form, /setTouched/);
  assert.match(form, /const MAX_ITEMS = 25/);
  assert.match(form, /const reset = \(\) => \{ interacted\.current = \{\}; setRows\(\[blank\(\)\]\);/);
  assert.match(form, /setRows\(current => current\.filter\(item => item\.key !== row\.key\)\)/);
  assert.match(form, /setRows\(current => \[\.\.\.current, blank\(\)\]\)/);
  assert.match(form, /const visibleError = \(row: Draft, field: Field\) => touched\[row\.key\]\?\.\[field\] && errors\[row\.key\]\?\.\[field\]/);
  assert.match(form, /createStockIns\(rows\.map/);
  assert.match(form, /createUsageRecords\(rows\.map/);
  assert.match(form, /createWasteRecords\(rows\.map/);
  assert.match(form, /className="sl-staff-derived-unit"/);
  assert.match(form, /field === 'ingredientId' \? \{ batchId: '' \}/);
  assert.match(form, /reset\(\); onDismiss\(\); await onSaved\(\)/);
  assert.match(form, /catch \(error\) \{/);
  assert.equal((modulePage.match(/<InventoryStaffBulkModal mode=/g) ?? []).length, 3);
});

test('repeatable recording rows use responsive contained modal geometry', () => {
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(styles, /\.sl-area-dialog\.sl-inventory-staff-bulk-dialog \{[\s\S]*?max-width: 960px;/);
  assert.match(styles, /\.sl-bulk-recording-grid \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?\.sl-bulk-recording-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(styles, /\.sl-inventory-staff-bulk-dialog \.sl-dialog-content \{[\s\S]*?overflow-y: auto;/);
});

test('bulk frontend services submit canonical items envelopes to dedicated endpoints', () => {
  const inventory = readFileSync(new URL('../src/services/inventory-batches.ts', import.meta.url), 'utf8');
  const usage = readFileSync(new URL('../src/services/usage-records.ts', import.meta.url), 'utf8');
  const waste = readFileSync(new URL('../src/services/waste-records.ts', import.meta.url), 'utf8');
  assert.match(inventory, /'\/inventory-batches\/bulk'[\s\S]*JSON\.stringify\(\{ items \}\)/);
  assert.match(usage, /'\/usage-records\/bulk'[\s\S]*JSON\.stringify\(\{ items \}\)/);
  assert.match(waste, /'\/waste-records\/bulk'[\s\S]*JSON\.stringify\(\{ items \}\)/);
});
