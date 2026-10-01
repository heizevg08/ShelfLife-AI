import { bodyFields, expectedVersion, inventoryPagination } from './inventory-contract';
import { invalid } from './administration';

import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../models/ingredient-options';
export { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../models/ingredient-options';
export type IngredientInput = {
  name: string;
  brand: string;
  description: string;
  category: typeof INGREDIENT_CATEGORIES[number];
  customCategory?: string;
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
const number = (field: string, value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined || value === '') invalid(field);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) invalid(field, `Enter a number from ${minimum} to ${maximum}`);
  return value;
};

const ingredientName = (field: 'name' | 'brand', value: unknown, required: boolean) => {
  const clean = cleanText(field, value, required, 42);
  const letters = (clean.match(/\p{L}/gu) ?? []).length;
  const digits = (clean.match(/[0-9]/g) ?? []).length;
  if (clean && (!/^[\p{L}0-9 ]+$/u.test(clean) || letters > 18 || digits > 3)) {
    invalid(field, 'Use letters and spaces with up to 18 letters and 3 numbers.');
  }
  return clean;
};

export function ingredientInput(body: unknown): IngredientInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  const fields = ['name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays'];
  for (const key of Object.keys(input)) if (!fields.includes(key)) invalid(key, 'Field is not permitted');
  if (typeof input.category !== 'string' || !INGREDIENT_CATEGORIES.includes(input.category as typeof INGREDIENT_CATEGORIES[number])) invalid('category', 'Select a valid category');
  const unit = cleanText('unitOfMeasure', input.unitOfMeasure, true, 50);
  if (!INGREDIENT_UNITS.includes(unit as typeof INGREDIENT_UNITS[number])) invalid('unitOfMeasure', 'Select a valid unit');
  const result: IngredientInput = {
    name: ingredientName('name', input.name, true),
    brand: ingredientName('brand', input.brand, false),
    description: cleanText('description', input.description, false, 100),
    category: input.category as typeof INGREDIENT_CATEGORIES[number],
    unitOfMeasure: unit as typeof INGREDIENT_UNITS[number],
  };
  if (input.customCategory !== undefined) {
    if (input.category !== 'Other') invalid('customCategory', 'A custom category is only valid when Other is selected');
    result.customCategory = cleanText('customCategory', input.customCategory, false, 50);
  }
  if (input.minimumStock !== undefined && input.minimumStock !== '') result.minimumStock = number('minimumStock', input.minimumStock, 0, 1_000_000);
  if (input.standardUnitCost !== undefined && input.standardUnitCost !== '') result.standardUnitCost = number('standardUnitCost', input.standardUnitCost, 0, 100_000);
  if (input.defaultShelfLifeDays !== undefined && input.defaultShelfLifeDays !== '') {
    const days = number('defaultShelfLifeDays', input.defaultShelfLifeDays, 1);
    if (!Number.isInteger(days)) invalid('defaultShelfLifeDays', 'Enter a whole number of at least 1');
    result.defaultShelfLifeDays = days;
  }
  return result;
}

export function ingredientPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'limit', 'search', 'category', 'unit', 'includeArchived'].includes(key)) invalid(key);
  if (query.includeArchived !== undefined && query.includeArchived !== 'true' && query.includeArchived !== 'false') invalid('includeArchived', 'Use true or false');
  const page = inventoryPagination(query);
  const search = query.search === undefined ? '' : cleanText('search', query.search, false, 100);
  const category = query.category === undefined ? '' : query.category;
  if (typeof category !== 'string' || (category && !INGREDIENT_CATEGORIES.includes(category as typeof INGREDIENT_CATEGORIES[number]))) invalid('category', 'Select a valid category');
  const unit = query.unit === undefined ? '' : query.unit;
  if (typeof unit !== 'string' || (unit && !INGREDIENT_UNITS.includes(unit as typeof INGREDIENT_UNITS[number]))) invalid('unit', 'Select a valid unit');
  return { ...page, search, category: category as '' | typeof INGREDIENT_CATEGORIES[number], unit: unit as '' | typeof INGREDIENT_UNITS[number], includeArchived: query.includeArchived === 'true' };
}
export type IngredientPageQuery = ReturnType<typeof ingredientPagination>;

export function ingredientPatch(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', 'name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays']);
  const version = expectedVersion(input.expectedVersion);
  const { expectedVersion: ignored, ...fields } = input;
  if (!Object.keys(fields).length) invalid('body', 'Provide at least one ingredient field');
  // Reuse create validation while retaining PATCH omission semantics.
  const validated = ingredientInput({ name: 'placeholder', category: 'Other', unitOfMeasure: 'pcs', ...fields });
  for (const key of ['minimumStock', 'standardUnitCost', 'defaultShelfLifeDays']) if (key in fields && !(key in validated)) invalid(key);
  const patch = Object.fromEntries(Object.keys(fields).map(key => [key, validated[key as keyof IngredientInput]])) as Partial<IngredientInput>;
  if (fields.category !== undefined && fields.category !== 'Other' && fields.customCategory === undefined) patch.customCategory = '';
  return { patch, expectedVersion: version };
}
