import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryBatchRecorderLabel } from '../src/utils/inventory-batch-recorder';

test('Stock-In large-dataset Ingredient uses a bounded control matching the native filter baseline', () => {
  const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const stockIn = source.slice(source.indexOf('function StockInIngredientFilter'), source.indexOf('function InventoryStaffInventoryBatchesPage'));
  assert.match(stockIn, /\{id:'All Ingredients',name:'All Ingredients'\}/);
  assert.match(stockIn, /option=>\(\{id:option\.id,name:/);
  assert.match(stockIn, /aria-haspopup="listbox"/);
  assert.match(stockIn, /role="combobox"/);
  assert.match(stockIn, /role="listbox"/);
  assert.match(stockIn, /role="option"/);
  assert.match(stockIn, /event\.key==='ArrowDown'\|\|event\.key==='ArrowUp'/);
  assert.match(stockIn, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(stockIn, /event\.key==='Escape'/);
  assert.match(stockIn, /document\.addEventListener\('mousedown',close\)/);
  assert.match(stockIn, /<span>Date range<\/span><select value=\{stockDateRange\}/);
  const sharedControl = styles.match(/:is\(\.sl-application-records,\.sl-sa-account-pattern-records\) :is\(\.sl-application-records-toolbar,\.sl-sa-ingredients-filter-card\) :is\(input,select\) \{([\s\S]*?)\}/)?.[1].replace(/\s/g,'') ?? '';
  const trigger = styles.match(/\.sl-stockin-ingredient-trigger \{([\s\S]*?)\}/)?.[1].replace(/\s/g,'') ?? '';
  for(const declaration of ['height:40px','min-height:40px','padding:0.75rem','border:1pxsolidvar(--sl-border)','border-radius:var(--sl-radius)','background:var(--sl-surface)','color:var(--sl-text)','font:var(--sl-font-supporting)']) assert.ok(sharedControl.includes(declaration)&&trigger.includes(declaration),declaration);
  assert.match(styles, /\.sl-stockin-ingredient-menu \{[\s\S]*?position:absolute;[\s\S]*?width:100%; max-width:100%; max-height:17rem;[\s\S]*?overflow-y:auto; overflow-x:hidden;/);
  assert.match(styles, /\.sl-stockin-ingredient-menu > button \{[^}]*overflow:hidden;[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/);
  assert.doesNotMatch(styles, /:is\([^)]*sl-staff-(?:usage|waste|inventory|requests)[^)]*\)[^{]*\.sl-stockin-ingredient/);
});

test('Stock-In recorder presentation requires persisted first and last names', () => {
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'ignored', firstName:'Juan', lastName:'Dela Cruz' }), 'Juan Dela Cruz');
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'Current Viewer', firstName:'', lastName:'' }), '—');
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'Development InventoryStaff', firstName:'Development', lastName:'InventoryStaff' }), '—');
  const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/components/application/InventoryBatchDetailsDialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.match(details, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.doesNotMatch(source, /currentUser[^\n]*Recorded By|user\.name[^\n]*Recorded By/);
});
