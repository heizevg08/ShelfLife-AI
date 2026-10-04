import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryBatchRecorderLabel } from '../src/utils/inventory-batch-recorder';

test('Stock-In large-dataset Ingredient uses a bounded control matching the native filter baseline', () => {
  const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const filterSelect = readFileSync(new URL('../src/components/application/FilterSelect.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const stockIn = source.slice(source.indexOf('function InventoryStaffStockInPage'), source.indexOf('function InventoryStaffInventoryBatchesPage'));
  assert.match(stockIn, /<FilterSelect ariaLabel="Ingredient"/);
  assert.match(stockIn, /const stockIngredientOptions = useMemo\(\(\) => \[\{value:'All Ingredients',label:'All Ingredients'\}/);
  assert.match(stockIn, /value:option\.id,label:formatHumanReadableText\(option\.name\)/);
  assert.match(stockIn, /options=\{stockIngredientOptions\}/);
  assert.doesNotMatch(source, /function StockInIngredientFilter/);
  assert.match(filterSelect, /aria-haspopup="listbox"/);
  assert.match(filterSelect, /role="combobox"/);
  assert.match(filterSelect, /role="listbox"/);
  assert.match(filterSelect, /role="option"/);
  assert.match(filterSelect, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(filterSelect, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(filterSelect, /event\.key === 'Escape'/);
  assert.match(filterSelect, /document\.addEventListener\('mousedown', close\)/);
  assert.match(filterSelect, /useId\(\)/);
  assert.match(filterSelect, /option\.disabled/);
  assert.match(stockIn, /<span>Date range<\/span><FilterSelect ariaLabel="Filter Stock-In by date range" value=\{stockDateRange\}/);
  const sharedControl = styles.match(/:is\(\.sl-application-records,\.sl-sa-account-pattern-records\) :is\(\.sl-application-records-toolbar,\.sl-sa-ingredients-filter-card\) :is\(input,select\) \{([\s\S]*?)\}/)?.[1].replace(/\s/g,'') ?? '';
  const trigger = styles.match(/\.sl-filter-select-trigger \{([\s\S]*?)\}/)?.[1].replace(/\s/g,'') ?? '';
  for(const declaration of ['height:40px','min-height:40px','padding:0.75rem','border:1pxsolidvar(--sl-border)','border-radius:var(--sl-radius)','background:var(--sl-surface)','color:var(--sl-text)','font:var(--sl-font-supporting)']) assert.ok(sharedControl.includes(declaration)&&trigger.includes(declaration),declaration);
  assert.match(styles, /\.sl-filter-select \{[^}]*width:100%;/);
  assert.match(styles, /\.sl-filter-select-menu \{[\s\S]*?position:fixed;[\s\S]*?max-width:calc\(100vw - 1rem\); max-height:17rem;[\s\S]*?overflow-y:auto; overflow-x:hidden;/);
  assert.match(styles, /\.sl-filter-select-option \{[^}]*overflow:hidden;[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/);
  assert.doesNotMatch(styles, /\.sl-stockin-ingredient-(?:filter|trigger|menu)/);
});

test('Stock-In recorder presentation requires persisted first and last names', () => {
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'ignored', firstName:'Juan', lastName:'Dela Cruz' }), 'Juan Dela Cruz');
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'Current Viewer', firstName:'', lastName:'' }), '—');
  assert.equal(inventoryBatchRecorderLabel({ id:'1', name:'Development InventoryStaff', firstName:'Development', lastName:'InventoryStaff' }), 'Development InventoryStaff');
  const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/components/application/InventoryBatchDetailsDialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.match(details, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.doesNotMatch(source, /currentUser[^\n]*Recorded By|user\.name[^\n]*Recorded By/);
});
