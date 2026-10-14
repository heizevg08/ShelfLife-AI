import { bodyFields, expectedVersion, inventoryPagination } from './inventory-contract';
import { invalid } from './administration';
import { catalogueText, proseText } from './text';

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

const number = (field: string, value: unknown, minimum: number, scale?: number, fallback?: number) => {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) invalid(field, `Enter a number of at least ${minimum}`);
  const encoded = String(value);
  // Ingredient values are JSON numbers until their legacy Number schema is migrated.
  // Reject exponent notation and values beyond the reliable integer precision boundary.
  if (/[eE]/u.test(encoded) || value > 999_999_999_999_999 || (scale !== undefined && (!new RegExp(`^(0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`).test(encoded)))) {
    invalid(field, scale === undefined ? 'Enter a finite nonnegative number within the supported range' : `Use a nonnegative number with at most ${scale} decimal places`);
  }
  return value;
};

export function ingredientInput(body: unknown): IngredientInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  const fields = ['name', 'brand', 'description', 'category', 'customCategory', 'unitOfMeasure', 'minimumStock', 'standardUnitCost', 'defaultShelfLifeDays'];
  for (const key of Object.keys(input)) if (!fields.includes(key)) invalid(key, 'Field is not permitted');
  if (typeof input.category !== 'string' || !INGREDIENT_CATEGORIES.includes(input.category as typeof INGREDIENT_CATEGORIES[number])) invalid('category', 'Select a valid category');
  const unit = catalogueText(input.unitOfMeasure, 'unitOfMeasure', true, 50);
  if (!INGREDIENT_UNITS.includes(unit as typeof INGREDIENT_UNITS[number])) invalid('unitOfMeasure', 'Select a valid unit');
  const result: IngredientInput = {
    name: catalogueText(input.name, 'name', true, 100),
    brand: catalogueText(input.brand, 'brand', false, 100),
    description: proseText(input.description, 'description', false, 500),
    category: input.category as typeof INGREDIENT_CATEGORIES[number],
    unitOfMeasure: unit as typeof INGREDIENT_UNITS[number],
  };
  if (input.customCategory !== undefined) {
    if (input.category !== 'Other') invalid('customCategory', 'A custom category is only valid when Other is selected');
    result.customCategory = catalogueText(input.customCategory, 'customCategory', false, 50);
  }
  if (input.minimumStock !== undefined && input.minimumStock !== '') result.minimumStock = number('minimumStock', input.minimumStock, 0, 3);
  if (input.standardUnitCost !== undefined && input.standardUnitCost !== '') result.standardUnitCost = number('standardUnitCost', input.standardUnitCost, 0, 4);
  if (input.defaultShelfLifeDays !== undefined && input.defaultShelfLifeDays !== '') {
    const days = number('defaultShelfLifeDays', input.defaultShelfLifeDays, 1);
    if (!Number.isInteger(days)) invalid('defaultShelfLifeDays', 'Enter a whole number of at least 1');
    result.defaultShelfLifeDays = days;
  }
  return result;
}

export function ingredientPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'limit', 'search', 'category', 'unit', 'status', 'includeArchived'].includes(key)) invalid(key);
  if (query.includeArchived !== undefined && query.includeArchived !== 'true' && query.includeArchived !== 'false') invalid('includeArchived', 'Use true or false');
  const page = inventoryPagination(query);
  const search = query.search === undefined ? '' : catalogueText(query.search, 'search', false, 100);
  const category = query.category === undefined ? '' : query.category;
  if (typeof category !== 'string' || (category && !INGREDIENT_CATEGORIES.includes(category as typeof INGREDIENT_CATEGORIES[number]))) invalid('category', 'Select a valid category');
  const unit = query.unit === undefined ? '' : query.unit;
  if (typeof unit !== 'string' || (unit && !INGREDIENT_UNITS.includes(unit as typeof INGREDIENT_UNITS[number]))) invalid('unit', 'Select a valid unit');
  const status = query.status === undefined ? '' : query.status;
  if (status !== '' && status !== 'active' && status !== 'archived' && status !== 'all') invalid('status', 'Select a valid ingredient status');
  return { ...page, search, category: category as '' | typeof INGREDIENT_CATEGORIES[number], unit: unit as '' | typeof INGREDIENT_UNITS[number], status: status as '' | 'active' | 'archived' | 'all', includeArchived: query.includeArchived === 'true' };
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
