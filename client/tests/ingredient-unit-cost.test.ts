import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientUnitCostApiValue, ingredientUnitCostError, ingredientUnitCostFormError, normalizeIngredientUnitCostEditingValue } from '../src/components/application/ingredient-unit-cost';

test('unit-cost editing preserves the exact character-by-character string', () => {
  for (const value of ['', '0', '1', '15', '15.', '15.5', '15.50', '0.50', '100.25']) {
    assert.equal(normalizeIngredientUnitCostEditingValue(value), value);
  }
});

test('unit-cost validation accepts optional values and at most two decimal places', () => {
  for (const value of ['', '0', '1', '15', '15.', '15.5', '15.50', '0.50', '100.25']) {
    assert.equal(ingredientUnitCostError(value), undefined, value);
  }
  for (const value of ['-1', 'abc', '15.555', '.', '1.2.3']) {
    assert.equal(ingredientUnitCostError(value), 'Enter a valid unit cost.', value);
  }
  assert.equal(ingredientUnitCostError('1000000001'), 'Enter a valid unit cost.');
});

test('unit-cost conversion happens only at the API boundary', () => {
  assert.equal(ingredientUnitCostApiValue(''), undefined);
  assert.equal(ingredientUnitCostApiValue('15'), 15);
  assert.equal(ingredientUnitCostApiValue('15.5'), 15.5);
  assert.equal(ingredientUnitCostApiValue('15.50'), 15.5);
  assert.equal(ingredientUnitCostApiValue('0.50'), 0.5);
});

test('unit-cost form validation distinguishes create requirements from malformed values', () => {
  assert.equal(ingredientUnitCostFormError('', true), 'Enter the standard unit cost.');
  assert.equal(ingredientUnitCostFormError('', false), undefined);
  assert.equal(ingredientUnitCostFormError('-1', true), 'Enter a valid unit cost.');
  assert.equal(ingredientUnitCostFormError('15.555', true), 'Enter a valid unit cost.');
  assert.equal(ingredientUnitCostFormError('15.50', true), undefined);
});
