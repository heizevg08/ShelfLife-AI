export const INGREDIENT_UNIT_COST_MAX = 1_000_000_000;

export function normalizeIngredientUnitCostEditingValue(value: string) {
  return value.replace(/^₱\s*/, '').replace(/,/g, '');
}

export function ingredientUnitCostError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return 'Enter a valid unit cost.';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue > INGREDIENT_UNIT_COST_MAX) {
    return 'Enter a valid unit cost.';
  }
  return undefined;
}

export function ingredientUnitCostFormError(value: string, required: boolean): string | undefined {
  if (value === '') return required ? 'Enter the standard unit cost.' : undefined;
  return ingredientUnitCostError(value);
}

export function ingredientUnitCostApiValue(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}
