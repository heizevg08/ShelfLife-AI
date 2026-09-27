import { invalid, objectId } from './administration';
import { calendarDate } from './date';

export const INVENTORY_BATCH_DISPLAY_STATUSES = ['In Stock', 'Low Stock', 'Near Expiry', 'Expired'] as const;
export type InventoryBatchDisplayStatus = typeof INVENTORY_BATCH_DISPLAY_STATUSES[number];
export type InventoryBatchPageQuery = { page: number; pageSize: number; search?: string; category?: string; status?: InventoryBatchDisplayStatus; ingredientId?: string; from?: Date; to?: Date };
export type StockInInput = { ingredientId: string; dateReceived: Date; quantity: number; expirationDate: Date; unitCost?: number };

const clean = (field: string, value: unknown, max: number) => {
  if (typeof value !== 'string') invalid(field);
  const result = value.trim().replace(/\s+/g, ' ');
  if (!result || result.length > max) invalid(field);
  return result;
};

export function inventoryBatchPagination(query: Record<string, unknown>): InventoryBatchPageQuery {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'search', 'category', 'status', 'ingredientId', 'from', 'to'].includes(key)) invalid(key);
  const integer = (key: 'page' | 'pageSize', fallback: number, max: number) => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) invalid(key);
    return Number(value);
  };
  const result: InventoryBatchPageQuery = { page: integer('page', 1, 1_000_000), pageSize: integer('pageSize', 10, 150) };
  if (query.search !== undefined) result.search = clean('search', query.search, 100);
  if (query.category !== undefined) result.category = clean('category', query.category, 50);
  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !INVENTORY_BATCH_DISPLAY_STATUSES.includes(query.status as InventoryBatchDisplayStatus)) invalid('status');
    result.status = query.status as InventoryBatchDisplayStatus;
  }
  if (query.ingredientId !== undefined) result.ingredientId = objectId(query.ingredientId);
  for (const key of ['from', 'to'] as const) if (query[key] !== undefined) {
    const date = calendarDate(key, query[key]);
    result[key] = key === 'to' ? new Date(date.getTime() + 86_400_000 - 1) : date;
  }
  if (result.from && result.to && result.from > result.to) invalid('to', 'End date must be on or after start date');
  return result;
}

export function stockInInput(body: unknown): StockInInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!['ingredientId', 'dateReceived', 'quantity', 'expirationDate', 'unitCost'].includes(key)) invalid(key, 'Field is not permitted');
  const date = (key: 'dateReceived' | 'expirationDate') => calendarDate(key, input[key]);
  const number = (key: 'quantity' | 'unitCost', required: boolean) => {
    const value = input[key];
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key === 'quantity' && value <= 0)) invalid(key);
    return value;
  };
  const result: StockInInput = { ingredientId: objectId(input.ingredientId), dateReceived: date('dateReceived'), quantity: number('quantity', true)!, expirationDate: date('expirationDate') };
  if (result.expirationDate <= result.dateReceived) invalid('expirationDate', 'Expiration date must be after date received');
  const unitCost = number('unitCost', false); if (unitCost !== undefined) result.unitCost = unitCost;
  return result;
}
