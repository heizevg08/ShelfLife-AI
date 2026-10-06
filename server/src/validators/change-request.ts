import { CHANGE_REQUEST_TARGET_FIELDS, CHANGE_REQUEST_TYPES } from '../models/change-request';
import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from '../models/ingredient-options';
import { invalid, objectId } from './administration';
import { bodyFields, expectedVersion } from './inventory-contract';

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export type ChangeRequestTargetField = typeof CHANGE_REQUEST_TARGET_FIELDS[number];
export const CHANGE_REQUEST_TARGET_BY_TYPE: Record<ChangeRequestType, ChangeRequestTargetField> = {
  MINIMUM_STOCK_CHANGE: 'minimumStock', STANDARD_UNIT_COST_CHANGE: 'standardUnitCost', CATEGORY_CHANGE: 'category',
  BRAND_CHANGE: 'brand', DESCRIPTION_CHANGE: 'description', UNIT_OF_MEASURE_CHANGE: 'unitOfMeasure',
  DEFAULT_SHELF_LIFE_CHANGE: 'defaultShelfLifeDays',
};

const own = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const prose = (field: string, value: unknown, min: number, max: number) => {
  if (typeof value !== 'string') invalid(field);
  const clean = value.trim().replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n');
  if (clean.length < min || clean.length > max) invalid(field, `Enter ${min}–${max} characters`);
  return clean;
};
const catalogue = (field: string, value: unknown, min: number, max: number) => {
  const clean = prose(field, value, min, max);
  if (/[\r\n\t\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/.test(clean)) invalid(field, 'Use plain single-line text');
  return clean;
};
// Ingredient Number fields remain Number in the current schema. This rejects
// exponent notation and values that would lose fixed-point precision in JS.
function numberText(field: string, value: unknown, scale: number): string {
  if (typeof value !== 'string' || !new RegExp(`^(0|[1-9]\\d{0,14})(?:\\.\\d{1,${scale}})?$`).test(value)) {
    invalid(field, `Use a nonnegative decimal string with at most ${scale} decimal places`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isSafeInteger(Math.round(numeric * 10 ** scale))) invalid(field);
  return value;
}
function integerText(field: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value) || !Number.isSafeInteger(Number(value))) invalid(field, 'Use a positive whole-number string');
  return value;
}

export type TypedChangeRequestInput = { requestType: ChangeRequestType; ingredientId: string; targetField: ChangeRequestTargetField; requestedValue: string; reason: string };
function requestedValue(type: ChangeRequestType, value: unknown) {
  switch (type) {
    case 'MINIMUM_STOCK_CHANGE': return numberText('requestedValue', value, 3);
    case 'STANDARD_UNIT_COST_CHANGE': return numberText('requestedValue', value, 4);
    case 'DEFAULT_SHELF_LIFE_CHANGE': return integerText('requestedValue', value);
    case 'CATEGORY_CHANGE': {
      const clean = catalogue('requestedValue', value, 1, 50);
      if (!INGREDIENT_CATEGORIES.includes(clean as typeof INGREDIENT_CATEGORIES[number])) invalid('requestedValue', 'Select a valid category');
      return clean;
    }
    case 'UNIT_OF_MEASURE_CHANGE': {
      const clean = catalogue('requestedValue', value, 1, 50);
      if (!INGREDIENT_UNITS.includes(clean as typeof INGREDIENT_UNITS[number])) invalid('requestedValue', 'Select a valid unit');
      return clean;
    }
    case 'BRAND_CHANGE': return catalogue('requestedValue', value, 0, 100);
    case 'DESCRIPTION_CHANGE': return prose('requestedValue', value, 0, 500);
  }
}
export function typedChangeRequestInput(body: unknown): TypedChangeRequestInput {
  const input = bodyFields(body, ['requestType', 'ingredientId', 'requestedValue', 'reason']);
  if (typeof input.requestType !== 'string' || !CHANGE_REQUEST_TYPES.includes(input.requestType as ChangeRequestType)) invalid('requestType', 'Select a valid request type');
  const requestType = input.requestType as ChangeRequestType;
  return {
    requestType, ingredientId: objectId(input.ingredientId), targetField: CHANGE_REQUEST_TARGET_BY_TYPE[requestType],
    requestedValue: requestedValue(requestType, input.requestedValue), reason: prose('reason', input.reason, 1, 500),
  };
}
export function typedChangeRequestQuery(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'limit', 'status'].includes(key)) invalid(key, 'Field is not permitted');
  const page = query.page === undefined ? 1 : positiveInteger('page', query.page, 1000000);
  const limit = query.limit === undefined ? 25 : positiveInteger('limit', query.limit, 100);
  if (query.status !== undefined && (typeof query.status !== 'string' || !['PENDING', 'APPROVED', 'REJECTED'].includes(query.status))) invalid('status', 'Select a valid status');
  return { page, limit, ...(query.status ? { status: query.status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}) };
}
function positiveInteger(field: string, value: unknown, max: number) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) invalid(field);
  return Number(value);
}
export function typedReviewInput(body: unknown, rejection: boolean) {
  if (!own(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['expectedVersion', 'reviewNote'].includes(key)) invalid(key, 'Field is not permitted');
  const version = expectedVersion(input.expectedVersion);
  const note = input.reviewNote === undefined ? '' : prose('reviewNote', input.reviewNote, rejection ? 1 : 0, 500);
  if (rejection && !note) invalid('reviewNote', 'Enter a review note');
  return { expectedVersion: version, reviewNote: note };
}
export function typedChangeRequestId(value: unknown) { return objectId(value); }
// Revalidation at approval uses the exact create rules, after a stored value
// is converted only at the Number-schema service boundary.
export function revalidateRequestedValue(type: ChangeRequestType, value: unknown) { return requestedValue(type, value); }
