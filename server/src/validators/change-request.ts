import { CHANGE_REQUEST_TARGET_FIELDS, CHANGE_REQUEST_TYPES } from '../models/change-request';
import { INGREDIENT_CATEGORIES } from './ingredient';
import { invalid, objectId } from './administration';

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export type ChangeRequestTargetField = typeof CHANGE_REQUEST_TARGET_FIELDS[number];
export const CHANGE_REQUEST_UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle', 'can', 'tray'] as const;
export const CHANGE_REQUEST_TARGET_BY_TYPE: Record<ChangeRequestType, ChangeRequestTargetField> = {
  MINIMUM_STOCK_CHANGE: 'minimumStock', STANDARD_UNIT_COST_CHANGE: 'standardUnitCost', CATEGORY_CHANGE: 'category', BRAND_CHANGE: 'brand', DESCRIPTION_CHANGE: 'description', UNIT_OF_MEASURE_CHANGE: 'unitOfMeasure', DEFAULT_SHELF_LIFE_CHANGE: 'defaultShelfLifeDays',
};
export type ChangeRequestInput = { requestType: ChangeRequestType; ingredientId: string; targetField: ChangeRequestTargetField; requestedValue: string; reason: string };
const cleanText = (field: string, value: unknown, minimum: number, maximum: number) => { if (typeof value !== 'string') invalid(field); const clean = value.trim().replace(/\s+/g, ' '); if (clean.length < minimum || clean.length > maximum) invalid(field); return clean; };
function normalizeRequestedValue(type: ChangeRequestType, value: unknown): string {
  if (type === 'MINIMUM_STOCK_CHANGE' || type === 'STANDARD_UNIT_COST_CHANGE') { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) invalid('requestedValue', 'Enter a valid non-negative value'); return String(value); }
  if (type === 'DEFAULT_SHELF_LIFE_CHANGE') { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 3650) invalid('requestedValue', 'Enter a valid shelf life in days'); return String(value); }
  const clean = cleanText('requestedValue', value, type === 'BRAND_CHANGE' || type === 'DESCRIPTION_CHANGE' ? 0 : 1, type === 'DESCRIPTION_CHANGE' ? 1000 : 120);
  if (type === 'CATEGORY_CHANGE' && !INGREDIENT_CATEGORIES.includes(clean as typeof INGREDIENT_CATEGORIES[number])) invalid('requestedValue', 'Select a valid category');
  if (type === 'UNIT_OF_MEASURE_CHANGE' && !CHANGE_REQUEST_UNITS.includes(clean as typeof CHANGE_REQUEST_UNITS[number])) invalid('requestedValue', 'Select a valid unit');
  return clean;
}
export function changeRequestInput(body: unknown): ChangeRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body'); const value = body as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!['requestType', 'ingredientId', 'requestedValue', 'reason'].includes(key)) invalid(key, 'Field is not permitted');
  if (typeof value.requestType !== 'string' || !CHANGE_REQUEST_TYPES.includes(value.requestType as ChangeRequestType)) invalid('requestType', 'Select a valid request type');
  const requestType = value.requestType as ChangeRequestType;
  return { requestType, ingredientId: objectId(value.ingredientId), targetField: CHANGE_REQUEST_TARGET_BY_TYPE[requestType], requestedValue: normalizeRequestedValue(requestType, value.requestedValue), reason: cleanText('reason', value.reason, 1, 500) };
}
export function changeRequestQuery(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'type', 'status', 'from', 'to'].includes(key)) invalid(key);
  const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 10); if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || ![10,15,50,100,150].includes(pageSize)) invalid('pageSize');
  if (query.type !== undefined && !CHANGE_REQUEST_TYPES.includes(query.type as ChangeRequestType)) invalid('type'); if (query.status !== undefined && !['PENDING','APPROVED','REJECTED'].includes(String(query.status))) invalid('status');
  const from = query.from === undefined ? undefined : new Date(String(query.from)), to = query.to === undefined ? undefined : new Date(String(query.to)); if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) invalid('date'); if (from && to && from > to) invalid('to','End date must be on or after start date');
  return { page, pageSize, ...(typeof query.search === 'string' && query.search.trim() ? { search: query.search.trim().slice(0,100) } : {}), ...(query.type ? { type: query.type as ChangeRequestType } : {}), ...(query.status ? { status: query.status as 'PENDING'|'APPROVED'|'REJECTED' } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
}
export function reviewInput(body: unknown, rejection: boolean) { if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body'); const value = body as Record<string,unknown>; for (const key of Object.keys(value)) if (key !== 'reviewNote') invalid(key,'Field is not permitted'); const reviewNote = value.reviewNote === undefined && !rejection ? undefined : cleanText('reviewNote',value.reviewNote,rejection ? 1 : 0,500); return { ...(reviewNote ? { reviewNote } : {}) }; }
