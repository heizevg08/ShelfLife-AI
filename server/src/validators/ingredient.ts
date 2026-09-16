import { invalid, pagination } from './administration';

export const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;
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
const number = (field: string, value: unknown, minimum: number, fallback?: number) => {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) invalid(field, `Enter a number of at least ${minimum}`);
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
  if (input.minimumStock !== undefined && input.minimumStock !== '') result.minimumStock = number('minimumStock', input.minimumStock, 0);
  if (input.standardUnitCost !== undefined && input.standardUnitCost !== '') result.standardUnitCost = number('standardUnitCost', input.standardUnitCost, 0);
  if (input.defaultShelfLifeDays !== undefined && input.defaultShelfLifeDays !== '') {
    const days = number('defaultShelfLifeDays', input.defaultShelfLifeDays, 1);
    if (!Number.isInteger(days)) invalid('defaultShelfLifeDays', 'Enter a whole number of at least 1');
    result.defaultShelfLifeDays = days;
  }
  return result;
}

export function ingredientPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'category'].includes(key)) invalid(key);
  const page = pagination(Object.fromEntries(['page', 'pageSize'].filter(key => query[key] !== undefined).map(key => [key, query[key]])), ['createdAt'], 'createdAt');
  const search = query.search === undefined ? '' : cleanText('search', query.search, false, 100);
  const category = query.category === undefined ? '' : query.category;
  if (typeof category !== 'string' || (category && !INGREDIENT_CATEGORIES.includes(category as typeof INGREDIENT_CATEGORIES[number]))) invalid('category', 'Select a valid category');
  return { ...page, search, category: category as '' | typeof INGREDIENT_CATEGORIES[number] };
}
export type IngredientPageQuery = ReturnType<typeof ingredientPagination>;
