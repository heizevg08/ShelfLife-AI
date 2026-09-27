import { invalid, pagination } from './administration';

export const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;
export const INGREDIENT_LIMITS = {
  minimumStock: 1_000_000_000,
  standardUnitCost: 1_000_000_000,
  defaultShelfLifeDays: 3_650,
} as const;
export type IngredientInput = {
  name: string;
  brand: string;
  description: string;
  category: typeof INGREDIENT_CATEGORIES[number];
  unitOfMeasure: string;
  minimumStock?: number;
  standardUnitCost?: number;
  defaultShelfLifeDays?: number;
};

const cleanText = (field: string, value: unknown, required: boolean, max: number) => {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = value.trim().replace(/\s+/g, ' ');
  if ((required && !clean) || clean.length > max) invalid(field, required ? `Enter 1–${max} characters` : `Use at most ${max} characters`);
  return clean;
};
const number = (field: string, value: unknown, minimum: number, maximum: number, fallback?: number) => {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) invalid(field, `Enter a number from ${minimum} to ${maximum.toLocaleString()}`);
  return value;
};

export function ingredientInput(body: unknown): IngredientInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  const fields = ['name', 'brand', 'description', 'category', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays'];
  for (const key of Object.keys(input)) if (!fields.includes(key)) invalid(key, 'Field is not permitted');
  if (typeof input.category !== 'string' || !INGREDIENT_CATEGORIES.includes(input.category as typeof INGREDIENT_CATEGORIES[number])) invalid('category', 'Select a valid category');
  const result: IngredientInput = {
    name: cleanText('name', input.name, true, 100),
    brand: cleanText('brand', input.brand, false, 100),
    description: cleanText('description', input.description, false, 500),
    category: input.category as typeof INGREDIENT_CATEGORIES[number],
    unitOfMeasure: cleanText('unitOfMeasure', input.unitOfMeasure, true, 50),
  };
  if (input.minimumStock !== undefined && input.minimumStock !== '') result.minimumStock = number('minimumStock', input.minimumStock, 0, INGREDIENT_LIMITS.minimumStock);
  if (input.standardUnitCost !== undefined && input.standardUnitCost !== '') {
    const cost = number('standardUnitCost', input.standardUnitCost, 0, INGREDIENT_LIMITS.standardUnitCost);
    if (Math.round(cost * 100) !== cost * 100) invalid('standardUnitCost', 'Use no more than 2 decimal places');
    result.standardUnitCost = cost;
  }
  if (input.defaultShelfLifeDays !== undefined && input.defaultShelfLifeDays !== '') {
    const days = number('defaultShelfLifeDays', input.defaultShelfLifeDays, 1, INGREDIENT_LIMITS.defaultShelfLifeDays);
    if (!Number.isInteger(days)) invalid('defaultShelfLifeDays', 'Enter a whole number of at least 1');
    result.defaultShelfLifeDays = days;
  }
  return result;
}

export function ingredientPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'category', 'unit'].includes(key)) invalid(key);
  const page = pagination(Object.fromEntries(['page', 'pageSize'].filter(key => query[key] !== undefined).map(key => [key, query[key]])), ['createdAt'], 'createdAt');
  const search = query.search === undefined ? '' : cleanText('search', query.search, false, 100);
  const category = query.category === undefined ? '' : query.category;
  if (typeof category !== 'string' || (category && !INGREDIENT_CATEGORIES.includes(category as typeof INGREDIENT_CATEGORIES[number]))) invalid('category', 'Select a valid category');
  const unit = query.unit === undefined ? '' : cleanText('unit', query.unit, false, 50);
  return { ...page, search, category: category as '' | typeof INGREDIENT_CATEGORIES[number], unit };
}
export type IngredientPageQuery = ReturnType<typeof ingredientPagination>;
