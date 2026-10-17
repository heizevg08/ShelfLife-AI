import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const managerInventory = readFileSync(new URL('../src/components/application/ManagerInventoryPage.tsx', import.meta.url), 'utf8');
const managerUsageWaste = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
const ingredientService = readFileSync(new URL('../src/services/ingredients.ts', import.meta.url), 'utf8');
const inventory = source.slice(source.indexOf('function InventoryStaffInventoryBatchesPage'), source.indexOf('function ManagerInventoryPage'));

test('Inventory Staff category filter lists every catalogue category', () => {
  assert.match(inventory, /INGREDIENT_CATEGORIES\.map\(value=>\(\{value,label:value\}\)\)/);
});

test('all role category filters share every catalogue category', () => {
  for (const category of ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other']) {
    assert.match(ingredientService, new RegExp(`['"]${category}['"]`));
  }
  assert.doesNotMatch(source, /adminInventorySummary\?\.categories/);
  assert.doesNotMatch(source, /ingredientCategoryOptions\.map/);
  assert.match(managerInventory, /INGREDIENT_CATEGORIES\.map\(value => \(\{value, label:value\}\)\)/);
  assert.match(managerUsageWaste, /INGREDIENT_CATEGORIES\.map\(value => \(\{value, label:value\}\)\)/);
});
