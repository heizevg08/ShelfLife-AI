// One place owns the numeric ingredient rules so every form accepts exactly what
// the API accepts. The ceilings mirror server/src/validators/ingredient.ts
// (INGREDIENT_LIMITS) and the messages match the ones the server returns, so a
// user never sees the browser accept a value the server will refuse.
//
// These are validation rules only. They clean nothing and store nothing: a valid
// value keeps the exact text the user typed, and an invalid one is refused with a
// message rather than silently rewritten.
export const INGREDIENT_MINIMUM_STOCK_MAX = 1_000_000_000;
export const INGREDIENT_UNIT_COST_MAX = 1_000_000_000;
export const INGREDIENT_DEFAULT_SHELF_LIFE_MAX = 3_650;

// The server's own wording, reused verbatim so the browser and the API agree.
export const INGREDIENT_MINIMUM_STOCK_MESSAGE = 'Minimum stock must be between 0 and 1,000,000,000.';
export const INGREDIENT_UNIT_COST_MESSAGE = 'Enter a valid unit cost.';
export const INGREDIENT_SHELF_LIFE_MESSAGE = 'Shelf life must be a whole number from 1 to 3,650 days.';

// The unavailable marker every ingredient read-out falls back to. It keeps an
// invalid or missing stored value from being shown as if it were a real figure.
export const INGREDIENT_UNAVAILABLE = '—';

// An empty string is "not provided" and is not this helper's business: each form
// decides whether the field is required. Anything present must be digits only, so
// "1e21", "Infinity", "-4" and "12abc" are refused before Number() sees them.
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

// Minimum stock: 0 to 1,000,000,000, whole or fractional, matching the API range.
export function ingredientMinimumStockError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!decimal(value)) return INGREDIENT_MINIMUM_STOCK_MESSAGE;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue > INGREDIENT_MINIMUM_STOCK_MAX) return INGREDIENT_MINIMUM_STOCK_MESSAGE;
  return undefined;
}

// Standard unit cost: non-negative, at most two decimal places, same ceiling as
// the API. A trailing dot stays valid because the existing control accepts it
// while the user is still typing ("15.").
export function ingredientUnitCostError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return INGREDIENT_UNIT_COST_MESSAGE;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue > INGREDIENT_UNIT_COST_MAX) return INGREDIENT_UNIT_COST_MESSAGE;
  return undefined;
}

// Default shelf life: a whole number of days from 1 to 3,650.
export function ingredientShelfLifeError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+$/.test(value)) return INGREDIENT_SHELF_LIFE_MESSAGE;
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > INGREDIENT_DEFAULT_SHELF_LIFE_MAX) return INGREDIENT_SHELF_LIFE_MESSAGE;
  return undefined;
}

export function formatIngredientCurrency(value: number | string | undefined): string {
  const amount = finiteNumber(value);
  return amount === undefined ? INGREDIENT_UNAVAILABLE : `₱${amount.toFixed(2)}`;
}

// Quantities keep the stored text (so 57 stays 57) and only gain the unit label.
// A value that already carries the unit is left alone, so no label is repeated.
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

export function formatIngredientShelfLife(value: number | string | undefined): string {
  const days = finiteNumber(value);
  if (days === undefined) return INGREDIENT_UNAVAILABLE;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
