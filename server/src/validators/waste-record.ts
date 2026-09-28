import { WASTE_REASONS } from '../models/waste-record';
import { invalid, objectId } from './administration';
import { calendarDate } from './date';

export type WasteReason = typeof WASTE_REASONS[number];
export type WasteCreateInput = { ingredientId: string; batchId: string; quantityWasted: number; reason: WasteReason; dateWasted: Date };
export type WastePageQuery = { page: number; pageSize: number; search?: string; reason?: WasteReason; ingredientId?: string; from?: Date; to?: Date };

export function wasteInput(body: unknown): WasteCreateInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['ingredientId', 'batchId', 'quantityWasted', 'reason', 'dateWasted'].includes(key)) invalid(key, 'Field is not permitted');
  if (typeof input.quantityWasted !== 'number' || !Number.isFinite(input.quantityWasted) || input.quantityWasted <= 0) invalid('quantityWasted', 'Enter a quantity greater than 0');
  if (typeof input.reason !== 'string' || !WASTE_REASONS.includes(input.reason as WasteReason)) invalid('reason', 'Select a valid waste reason');
  return { ingredientId: objectId(input.ingredientId), batchId: objectId(input.batchId), quantityWasted: input.quantityWasted, reason: input.reason as WasteReason, dateWasted: calendarDate('dateWasted', input.dateWasted) };
}

export function wastePagination(query: Record<string, unknown>): WastePageQuery {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'reason', 'ingredientId', 'from', 'to'].includes(key)) invalid(key);
  const integer = (field: 'page' | 'pageSize', fallback: number, max: number) => {
    const value = query[field];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) invalid(field);
    return Number(value);
  };
  const result: WastePageQuery = { page: integer('page', 1, 1_000_000), pageSize: integer('pageSize', 10, 150) };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || !query.search.trim() || query.search.trim().length > 100) invalid('search');
    result.search = query.search.trim().replace(/\s+/g, ' ');
  }
  if (query.reason !== undefined) {
    if (typeof query.reason !== 'string' || !WASTE_REASONS.includes(query.reason as WasteReason)) invalid('reason');
    result.reason = query.reason as WasteReason;
  }
  if (query.ingredientId !== undefined) result.ingredientId = objectId(query.ingredientId);
  if (query.from !== undefined) result.from = calendarDate('from', query.from);
  if (query.to !== undefined) result.to = new Date(calendarDate('to', query.to).getTime() + 86_400_000 - 1);
  if (result.from && result.to && result.from > result.to) invalid('to', 'End date must be on or after start date');
  return result;
}
