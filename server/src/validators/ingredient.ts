import { bodyFields, expectedVersion, inventoryPagination } from './inventory-contract';
import { invalid } from './administration';

import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../models/ingredient-options';
export { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../models/ingredient-options';
export type IngredientInput = {
  name: string;
  brand: string;
  description: string;
  category: typeof INGREDIENT_CATEGORIES[number];
  unitOfMeasure: typeof INGREDIENT_UNITS[number];
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
  const unit = cleanText('unitOfMeasure', input.unitOfMeasure, true, 50);
  if (!INGREDIENT_UNITS.includes(unit as typeof INGREDIENT_UNITS[number])) invalid('unitOfMeasure', 'Select a valid unit');
  const result: IngredientInput = {
    name: cleanText('name', input.name, true, 100),
    brand: cleanText('brand', input.brand, false, 100),
    description: cleanText('description', input.description, false, 500),
    category: input.category as typeof INGREDIENT_CATEGORIES[number],
    unitOfMeasure: unit as typeof INGREDIENT_UNITS[number],
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
  for (const key of Object.keys(query)) if (!['page', 'limit', 'search', 'category', 'includeArchived'].includes(key)) invalid(key);
  if (query.includeArchived !== undefined && query.includeArchived !== 'true' && query.includeArchived !== 'false') invalid('includeArchived', 'Use true or false');
  const page = inventoryPagination(query);
  const search = query.search === undefined ? '' : cleanText('search', query.search, false, 100);
  const category = query.category === undefined ? '' : query.category;
  if (typeof category !== 'string' || (category && !INGREDIENT_CATEGORIES.includes(category as typeof INGREDIENT_CATEGORIES[number]))) invalid('category', 'Select a valid category');
  return { ...page, search, category: category as '' | typeof INGREDIENT_CATEGORIES[number], includeArchived: query.includeArchived === 'true' };
}
export type IngredientPageQuery = ReturnType<typeof ingredientPagination>;

export function ingredientPatch(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', 'name', 'brand', 'description', 'category', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays']);
  const version = expectedVersion(input.expectedVersion);
  const { expectedVersion: ignored, ...fields } = input;
  if (!Object.keys(fields).length) invalid('body', 'Provide at least one ingredient field');
  // Reuse create validation while retaining PATCH omission semantics.
  const validated = ingredientInput({ name: 'placeholder', category: 'Other', unitOfMeasure: 'pcs', ...fields });
  for (const key of ['minimumStock', 'standardUnitCost', 'defaultShelfLifeDays']) if (key in fields && !(key in validated)) invalid(key);
  const patch = Object.fromEntries(Object.keys(fields).map(key => [key, validated[key as keyof IngredientInput]])) as Partial<IngredientInput>;
  return { patch, expectedVersion: version };
}
