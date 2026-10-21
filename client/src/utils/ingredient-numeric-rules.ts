// Keep these limits and messages aligned with server/src/validators/ingredient.ts.
// Validation never rewrites the user's input while they are still typing.
export const INGREDIENT_MINIMUM_STOCK_MAX = 1_000_000_000;
export const INGREDIENT_UNIT_COST_MAX = 1_000_000_000;
export const INGREDIENT_DEFAULT_SHELF_LIFE_MAX = 3_650;
export const CHANGE_REQUEST_MINIMUM_STOCK_MAX = 1_000_000;

// Reuse server wording so client and API errors agree.
export const INGREDIENT_MINIMUM_STOCK_MESSAGE = 'Minimum stock must be between 0 and 1,000,000,000.';
export const INGREDIENT_UNIT_COST_MESSAGE = 'Enter a valid unit cost.';
export const INGREDIENT_SHELF_LIFE_MESSAGE = 'Shelf life must be a whole number from 1 to 3,650 days.';

// Never display an invalid stored value as a real quantity or price.
export const INGREDIENT_UNAVAILABLE = '—';

// Empty input is left to each form's required-field rule; reject exponent notation.
const decimal = (value: string) => /^\d+(?:\.\d+)?$/.test(value);

const finiteNumber = (value: number | string | undefined) => {
  if (value === undefined || value === '') return undefined;
  // Only a plain decimal literal counts. A stringified extreme such as '1e+21'
  // is finite to Number(), and Number('1e+21').toFixed(2) returns '1e+21'
  // unchanged, so it would otherwise be shown as if it were real money.
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return undefined;
  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

/**
 * Apply the API minimum-stock range without changing the entered text.
 * @param value - Decimal text; empty input is handled by the form.
 * @returns Validation message, or `undefined` when valid.
 */
export function ingredientMinimumStockError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!decimal(value)) return INGREDIENT_MINIMUM_STOCK_MESSAGE;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > INGREDIENT_MINIMUM_STOCK_MAX) return INGREDIENT_MINIMUM_STOCK_MESSAGE;
  return undefined;
}

/**
 * Apply the smaller minimum-stock ceiling used by change requests.
 * @param value - Decimal text; empty input is handled by the form.
 * @returns Validation message, or `undefined` when valid.
 */
export function changeRequestMinimumStockError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!decimal(value)) return 'Minimum stock must be from 0 to 1,000,000.';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > CHANGE_REQUEST_MINIMUM_STOCK_MAX) return 'Minimum stock must be from 0 to 1,000,000.';
  return undefined;
}

/**
 * Match the API cost range while allowing a trailing dot during entry.
 * @param value - Unit-cost text; empty input is handled by the form.
 * @returns Validation message, or `undefined` when valid.
 */
export function ingredientUnitCostError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return INGREDIENT_UNIT_COST_MESSAGE;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue > INGREDIENT_UNIT_COST_MAX) return INGREDIENT_UNIT_COST_MESSAGE;
  return undefined;
}

/**
 * Validate a whole-day shelf life against the API range.
 * @param value - Day count as text; empty input is handled by the form.
 * @returns Validation message, or `undefined` when valid.
 */
export function ingredientShelfLifeError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+$/.test(value)) return INGREDIENT_SHELF_LIFE_MESSAGE;
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > INGREDIENT_DEFAULT_SHELF_LIFE_MAX) return INGREDIENT_SHELF_LIFE_MESSAGE;
  return undefined;
}

/**
 * Hide malformed stored prices rather than render misleading currency.
 * @param value - Numeric price or its stored text.
 * @returns Peso amount with two decimals, or the unavailable marker.
 */
export function formatIngredientCurrency(value: number | string | undefined): string {
  const amount = finiteNumber(value);
  return amount === undefined ? INGREDIENT_UNAVAILABLE : `₱${amount.toFixed(2)}`;
}

/**
 * Preserve the stored quantity text and add its unit only when absent.
 * @param value - Quantity or stored text to validate.
 * @param unit - Optional unit label.
 * @returns Quantity with one unit label, or the unavailable marker.
 */
export function formatIngredientQuantity(value: number | string | undefined, unit?: string): string {
  if (value === undefined || value === '') return INGREDIENT_UNAVAILABLE;
  const text = String(value).trim();
  const trimmedUnit = unit?.trim();
  // The number in front of an attached unit is what gets validated, so "57 kg"
  // is judged as 57 while "1e+21 kg" is still refused.
  const withUnit = Boolean(trimmedUnit) && text.toLowerCase().endsWith(` ${trimmedUnit!.toLowerCase()}`);
  const numberPart = withUnit ? text.slice(0, text.length - trimmedUnit!.length - 1) : text;
  if (finiteNumber(numberPart) === undefined) return INGREDIENT_UNAVAILABLE;
  if (!trimmedUnit || withUnit) return text;
  return `${text} ${trimmedUnit}`;
}

/**
 * Render a valid shelf-life count with the correct singular or plural unit.
 * @param value - Day count or stored text.
 * @returns Day count for display, or the unavailable marker.
 */
export function formatIngredientShelfLife(value: number | string | undefined): string {
  const days = finiteNumber(value);
  if (days === undefined) return INGREDIENT_UNAVAILABLE;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
