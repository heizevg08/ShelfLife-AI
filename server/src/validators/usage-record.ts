import { invalid, objectId } from './administration';
import { calendarDate } from './date';

export type UsageCreateInput = { ingredientId: string; batchId: string; dateUsed: Date; quantityUsed: number };
export type UsagePageQuery = { page: number; pageSize: number; search?: string; ingredientId?: string; from?: Date; to?: Date };

export function usageInput(body: unknown): UsageCreateInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['ingredientId', 'batchId', 'dateUsed', 'quantityUsed'].includes(key)) invalid(key, 'Field is not permitted');
  if (typeof input.quantityUsed !== 'number' || !Number.isFinite(input.quantityUsed) || input.quantityUsed <= 0) invalid('quantityUsed', 'Enter a quantity greater than 0');
  return { ingredientId: objectId(input.ingredientId), batchId: objectId(input.batchId), dateUsed: calendarDate('dateUsed', input.dateUsed), quantityUsed: input.quantityUsed };
}

export function usagePagination(query: Record<string, unknown>): UsagePageQuery {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'ingredientId', 'from', 'to'].includes(key)) invalid(key);
  const integer = (field: 'page' | 'pageSize', fallback: number, max: number) => {
    const value = query[field];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) invalid(field);
    return Number(value);
  };
  const result: UsagePageQuery = { page: integer('page', 1, 1_000_000), pageSize: integer('pageSize', 10, 150) };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || !query.search.trim() || query.search.trim().length > 100) invalid('search');
    result.search = query.search.trim().replace(/\s+/g, ' ');
  }
  if (query.ingredientId !== undefined) result.ingredientId = objectId(query.ingredientId);
  if (query.from !== undefined) result.from = calendarDate('from', query.from);
  if (query.to !== undefined) result.to = new Date(calendarDate('to', query.to).getTime() + 86_400_000 - 1);
  if (result.from && result.to && result.from > result.to) invalid('to', 'End date must be on or after start date');
  return result;
}
