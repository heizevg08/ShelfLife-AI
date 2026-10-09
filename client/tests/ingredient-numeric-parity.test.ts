import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatIngredientCurrency,
  formatIngredientQuantity,
  formatIngredientShelfLife,
  ingredientMinimumStockError,
  ingredientShelfLifeError,
  ingredientUnitCostError,
  INGREDIENT_UNAVAILABLE,
} from '../src/utils/ingredient-numeric-rules';
import { formatStaffChangeRequestValue } from '../src/utils/change-request-format';

// The frontend must accept exactly what the API accepts. These ranges mirror
// server/src/validators/ingredient.ts, and the limits below are read straight
// from that file so a server change cannot drift silently past this test.
test('frontend numeric rules match the server ingredient ranges', () => {
  const server = readFileSync(new URL('../../server/src/validators/ingredient.ts', import.meta.url), 'utf8');
  assert.match(server, /minimumStock: 1_000_000_000,/);
  assert.match(server, /standardUnitCost: 1_000_000_000,/);
  assert.match(server, /defaultShelfLifeDays: 3_650,/);
  assert.match(server, /number\('minimumStock', input\.minimumStock, 0, INGREDIENT_LIMITS\.minimumStock\)/);
  assert.match(server, /number\('standardUnitCost', input\.standardUnitCost, 0, INGREDIENT_LIMITS\.standardUnitCost\)/);
  assert.match(server, /number\('defaultShelfLifeDays', input\.defaultShelfLifeDays, 1, INGREDIENT_LIMITS\.defaultShelfLifeDays\)/);
  assert.match(server, /Use no more than 2 decimal places/);
  assert.match(server, /Enter a whole number of at least 1/);
});

test('minimum stock accepts 0 to 1,000,000,000 and refuses everything else', () => {
  for (const value of ['0', '1', '5.5', '57', '999999999', '1000000000']) {
    assert.equal(ingredientMinimumStockError(value), undefined, value);
  }
  for (const value of ['-1', '1000000001', '1000000001.5', '1e21', '1e+21', 'Infinity', '-Infinity', 'NaN', 'abc', '12abc', '0x10', '  5  ']) {
    assert.equal(ingredientMinimumStockError(value), 'Minimum stock must be between 0 and 1,000,000,000.', value);
  }
});

test('standard unit cost stays non-negative, two decimals, within the ceiling', () => {
  for (const value of ['0', '1', '15', '15.', '15.5', '15.50', '0.50', '100.25', '1000000000', '1000000000.00']) {
    assert.equal(ingredientUnitCostError(value), undefined, value);
  }
  for (const value of ['-1', '-0.01', '15.555', '1000000000.01', '1e21', '1e+21', 'Infinity', 'NaN', 'abc', '1.2.3', '.', '1,000']) {
    assert.equal(ingredientUnitCostError(value), 'Enter a valid unit cost.', value);
  }
});

test('default shelf life is a whole number from 1 to 3,650 days', () => {
  for (const value of ['1', '7', '30', '3650']) {
    assert.equal(ingredientShelfLifeError(value), undefined, value);
  }
  for (const value of ['0', '-1', '1.5', '3651', '1e3', '1e+21', 'Infinity', 'NaN', 'abc', '3,650']) {
    assert.equal(ingredientShelfLifeError(value), 'Shelf life must be a whole number from 1 to 3,650 days.', value);
  }
});

// The display defect: an invalid stored value used to render as real currency,
// because Number('1e+21').toFixed(2) returns the string '1e+21' instead of
// throwing. Both the helper and the change-request formatter must fall back to
// the unavailable marker instead of showing a misleading figure.
test('invalid stored numbers render as unavailable, never as money or quantity', () => {
  assert.equal(formatIngredientCurrency('1e+21'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientCurrency('Infinity'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientCurrency('abc'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientCurrency(undefined), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientCurrency('100'), '₱100.00');
  assert.equal(formatIngredientCurrency(15.5), '₱15.50');
  assert.equal(formatIngredientQuantity('1e+21', 'kg'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientQuantity('abc', 'kg'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientShelfLife('1e+21'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatIngredientShelfLife('abc'), INGREDIENT_UNAVAILABLE);

  // Valid values keep their existing precision and unit conventions.
  assert.equal(formatIngredientQuantity(57, 'kg'), '57 kg');
  assert.equal(formatIngredientQuantity('57', 'kg'), '57 kg');
  assert.equal(formatIngredientQuantity('57 kg', 'kg'), '57 kg');
  assert.equal(formatIngredientShelfLife('1'), '1 day');
  assert.equal(formatIngredientShelfLife('30'), '30 days');

  // The shared change-request formatter heals the same inputs.
  assert.equal(formatStaffChangeRequestValue({ targetField: 'standardUnitCost' }, '1e+21'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatStaffChangeRequestValue({ targetField: 'minimumStock', ingredient: { unitOfMeasure: 'kg' } }, '1e+21'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatStaffChangeRequestValue({ targetField: 'defaultShelfLifeDays' }, 'abc'), INGREDIENT_UNAVAILABLE);
  assert.equal(formatStaffChangeRequestValue({ targetField: 'standardUnitCost' }, '555'), '₱555.00');
  assert.equal(formatStaffChangeRequestValue({ targetField: 'minimumStock', ingredient: { unitOfMeasure: 'kg' } }, '57'), '57 kg');
});

// The three input paths must share the rules: no path may keep a looser check.
test('every affected input path validates through the shared rules', () => {
  const modulePage = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const myRequests = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const unitCost = readFileSync(new URL('../src/components/application/ingredient-unit-cost.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/change-requests.ts', import.meta.url), 'utf8');

  // Both ingredient forms import the shared rules rather than restating them.
  assert.match(modulePage, /import \{ formatIngredientCurrency, ingredientMinimumStockError, ingredientShelfLifeError \} from '\.\.\/\.\.\/utils\/ingredient-numeric-rules';/);
  assert.equal((modulePage.match(/ingredientMinimumStockError\(clean\.minStock\)/g) ?? []).length, 2);
  assert.equal((modulePage.match(/ingredientShelfLifeError\(clean\.shelfLife\)/g) ?? []).length, 2);
  assert.match(modulePage, /ingredientUnitCostFormError\(clean\.unitCost, !editIngredient\)/);
  assert.match(modulePage, /ingredientUnitCostError\(clean\.unitCost\)/);
  // The old looser checks are gone.
  assert.doesNotMatch(modulePage, /must be 0 or greater/);
  assert.doesNotMatch(modulePage, /whole number of at least 1 day/);
  assert.doesNotMatch(modulePage, /Number\.isFinite\(Number\(clean\.minStock\)\) \|\| Number\(clean\.minStock\) < 0 \|\| Number\(clean\.minStock\) > 1_000_000_000/);

  // My Requests checks the requested value against the rule for its own type.
  assert.match(myRequests, /draft\.requestType==='MINIMUM_STOCK_CHANGE'\)next\.requestedValue=ingredientMinimumStockError\(draft\.requestedValue\.trim\(\)\)\?\?''/);
  assert.match(myRequests, /draft\.requestType==='STANDARD_UNIT_COST_CHANGE'\)next\.requestedValue=ingredientUnitCostError\(draft\.requestedValue\.trim\(\)\)\?\?''/);
  assert.match(myRequests, /draft\.requestType==='DEFAULT_SHELF_LIFE_CHANGE'\)next\.requestedValue=ingredientShelfLifeError\(draft\.requestedValue\.trim\(\)\)\?\?''/);
  assert.doesNotMatch(myRequests, /next\.requestedValue='Enter a valid value\.'/);
  assert.doesNotMatch(myRequests, /\['MINIMUM_STOCK_CHANGE','STANDARD_UNIT_COST_CHANGE','DEFAULT_SHELF_LIFE_CHANGE'\]\.includes\(draft\.requestType\)&&\(!Number\.isFinite/);

  // One rule set serves the pre-filled cost input and the forms: the helper keeps
  // its published names but no longer holds a second copy of the ceiling.
  assert.match(unitCost, /export const ingredientUnitCostError = sharedUnitCostError;/);
  assert.match(unitCost, /import \{ INGREDIENT_UNIT_COST_MAX, ingredientUnitCostError as sharedUnitCostError \} from '\.\.\/\.\.\/utils\/ingredient-numeric-rules';/);
  assert.doesNotMatch(unitCost, /export const INGREDIENT_UNIT_COST_MAX = 1_000_000_000;/);

  // The one currency display that bypassed the guard now routes through it.
  assert.match(service, /export const changeRequestValue = \(record: ChangeRequest, value: string \| undefined\) => formatStaffChangeRequestValue\(record, value\);/);
  assert.doesNotMatch(service, /return `₱\$\{Number\(value\)\.toFixed\(2\)\}`/);
  assert.doesNotMatch(modulePage, /₱\$\{viewIngredient\.standardUnitCost\.toFixed\(2\)\}/);
  assert.equal((modulePage.match(/formatIngredientCurrency\(viewIngredient\.standardUnitCost\)/g) ?? []).length, 2);
});

// STATUS and ACTIONS must read as one pair, without touching the shared table.
test('Manager Change Requests associates STATUS with ACTIONS inside the module only', () => {
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(thead th,tbody td\):nth-child\(6\),\s*\.sl-manager-change-requests-live \.sl-application-records-table :is\(thead th,tbody td\):nth-child\(7\) \{ text-align:center!important; padding-inline:\.375rem!important; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table tbody td:nth-child\(7\) \.sl-staff-waste-row-actions \{ justify-content:center!important; \}/);
  // The shared records-table alignment is untouched, so no other module moves.
  assert.match(styles, /\.sl-sa-records-dash-row>td:not\(\.sl-sa-ingredients-actions-cell\) \{\s*text-align: center!important;/);
  assert.match(styles, /:is\(\.sl-sa-ingredients-actions-cell,\.sl-application-row-actions,\.sl-staff-waste-row-actions\) \{\s*text-align: center!important;/);
  // Column widths keep seven columns on one line with no trailing dead space;
  // INGREDIENT owns what ACTIONS does not need, and local scrolling is unchanged.
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \{ min-width: 76rem; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(3\) \{ width: 29%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(7\) \{ width: 7%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(6\) \{ width: 9%; \}/);
  assert.doesNotMatch(styles, /sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(8\)/);
});

test('ingredient name form and server keep the same normalized 1–50 boundary', () => {
  const server = readFileSync(new URL('../../server/src/validators/ingredient.ts', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../../server/src/models/ingredient.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  assert.match(server, /name: cleanText\('name', input\.name, true, 50\)/);
  assert.match(model, /name: \{ type: String, required: true, trim: true, maxlength: 50 \}/);
  assert.equal((form.match(/if \(!clean\.name \|\| clean\.name\.length > 50\) next\.name = 'Enter 1–50 characters\.';/g) ?? []).length, 2);
  assert.equal((form.match(/name: form\.name\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)/g) ?? []).length, 2);
});
