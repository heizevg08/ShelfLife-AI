import { WASTE_REASONS, type RecordKind } from '../models/inventory-record';
import { invalid, objectId } from './administration';
import { bodyFields, calendarDate, decimal, decimalUnits, expectedVersion, inventoryPagination } from './inventory-contract';

export type CreateRecordInput = { ingredientId: string; batchId: string; quantity: string; recordedAt: string; notes: string; reason?: typeof WASTE_REASONS[number] };
const ids = ['ingredientId', 'batchId'] as const;
export function recordCreateInput(kind: RecordKind, body: unknown): CreateRecordInput {
  const input = bodyFields(body, [...ids, 'quantity', 'recordedAt', 'notes', ...(kind === 'WasteRecord' ? ['reason'] : [])]);
  const ingredientId = objectId(input.ingredientId), batchId = objectId(input.batchId);
  const quantity = decimal(input.quantity, 3, 'quantity');
  if (decimalUnits(quantity) === 0n) invalid('quantity', 'Quantity must be positive');
  const recordedAt = calendarDate(input.recordedAt, 'recordedAt');
  if (input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.trim().length > 500)) invalid('notes', 'Use at most 500 characters');
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (kind !== 'WasteRecord') return { ingredientId, batchId, quantity, recordedAt, notes };
  if (typeof input.reason !== 'string' || !WASTE_REASONS.includes(input.reason as typeof WASTE_REASONS[number])) invalid('reason', 'Select a valid waste reason');
  if (input.reason === 'Other' && !notes) invalid('notes', 'Notes are required when reason is Other');
  return { ingredientId, batchId, quantity, recordedAt, notes, reason: input.reason as typeof WASTE_REASONS[number] };
}
export function recordCorrectionInput(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', 'correctedQuantity', 'reason']);
  const correctedQuantity = decimal(input.correctedQuantity, 3, 'correctedQuantity');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500) invalid('reason', 'Provide a correction reason (1–500 characters)');
  return { expectedVersion: expectedVersion(input.expectedVersion), correctedQuantity, reason: input.reason.trim() };
}
export function recordArchiveInput(body: unknown) { return expectedVersion(bodyFields(body, ['expectedVersion']).expectedVersion); }
export function recordPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'limit', 'includeArchived', 'ingredientId', 'batchId', 'recordedBy', 'from', 'to'].includes(key)) invalid(key);
  const page = inventoryPagination(query);
  const result: { page: number; limit: number; includeArchived: boolean; ingredientId?: string; batchId?: string; recordedBy?: string; from?: string; to?: string } = page;
  for (const field of ['ingredientId', 'batchId', 'recordedBy'] as const) if (query[field] !== undefined) result[field] = objectId(query[field]);
  if (query.from !== undefined) result.from = calendarDate(query.from, 'from');
  if (query.to !== undefined) result.to = calendarDate(query.to, 'to');
  if (result.from && result.to && result.from > result.to) invalid('to', 'End date must be on or after start date');
  return result;
}
