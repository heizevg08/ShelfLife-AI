// The unit-cost rules live in utils/ingredient-numeric-rules.ts with the rest of
// the numeric parity rules, so the pre-filled cost input and every other form
// validate identically. This module keeps its published surface unchanged.
import { INGREDIENT_UNIT_COST_MAX, ingredientUnitCostError as sharedUnitCostError } from '../../utils/ingredient-numeric-rules';

export { INGREDIENT_UNIT_COST_MAX };

export function normalizeIngredientUnitCostEditingValue(value: string) {
  return value.replace(/^₱\s*/, '').replace(/,/g, '');
}

export const ingredientUnitCostError = sharedUnitCostError;

export function ingredientUnitCostFormError(value: string, required: boolean): string | undefined {
  if (value === '') return required ? 'Enter the standard unit cost.' : undefined;
  return ingredientUnitCostError(value);
}

export function ingredientUnitCostApiValue(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}
