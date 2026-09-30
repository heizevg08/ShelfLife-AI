import { INGREDIENT_UNITS } from '../models/ingredient-options';
import { invalid, objectId } from './administration';
import { bodyFields, calendarDate, decimal, decimalUnits, expectedVersion, inventoryPagination } from './inventory-contract';
import { batchCodeInput, proseText } from './text';

export type BatchMetadata = { unit: typeof INGREDIENT_UNITS[number]; unitCost: string; dateReceived: string; expirationDate: string };
export type BatchInput = BatchMetadata & { ingredientId: string; batchCode: string; initialQuantity: string };
const metadataFields = ['unit', 'unitCost', 'dateReceived', 'expirationDate'] as const;
export function batchDates(dateReceived: string, expirationDate: string) {
  if (expirationDate <= dateReceived) invalid('expirationDate', 'Expiration must be after the received calendar date');
}
function metadata(input: Record<string, unknown>, partial: boolean): Partial<BatchMetadata> {
  const result: Partial<BatchMetadata> = {};
  if (!partial || input.unit !== undefined) {
    if (typeof input.unit !== 'string' || !INGREDIENT_UNITS.includes(input.unit as typeof INGREDIENT_UNITS[number])) invalid('unit', 'Select a valid unit');
    result.unit = input.unit as typeof INGREDIENT_UNITS[number];
  }
  if (!partial || input.unitCost !== undefined) result.unitCost = decimal(input.unitCost, 4, 'unitCost');
  for (const key of ['dateReceived', 'expirationDate'] as const) if (!partial || input[key] !== undefined) result[key] = calendarDate(input[key], key);
  return result;
}
export function batchInput(body: unknown): BatchInput {
  const input = bodyFields(body, ['ingredientId', 'batchCode', 'initialQuantity', ...metadataFields]);
  const ingredientId = objectId(input.ingredientId);
  const initialQuantity = decimal(input.initialQuantity, 3, 'initialQuantity');
  if (decimalUnits(initialQuantity) === 0n) invalid('initialQuantity', 'Initial quantity must be positive');
  const fields = metadata(input, false) as BatchMetadata;
  batchDates(fields.dateReceived, fields.expirationDate);
  return { ingredientId, batchCode: batchCodeInput(input.batchCode), initialQuantity, ...fields };
}
export function batchPatch(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', ...metadataFields]);
  const version = expectedVersion(input.expectedVersion), patch = metadata(input, true);
  if (!Object.keys(patch).length) invalid('body', 'Provide at least one batch field');
  return { expectedVersion: version, patch };
}
export function batchCorrection(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', 'correctedQuantity', 'approved', 'reason']);
  if (input.approved !== true) invalid('approved', 'Explicit Manager approval is required');
  return { expectedVersion: expectedVersion(input.expectedVersion), correctedQuantity: decimal(input.correctedQuantity, 3, 'correctedQuantity'), reason: proseText(input.reason, 'reason', true, 500) };
}
export function batchPagination(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) if (!['page', 'limit', 'includeArchived', 'ingredientId'].includes(key)) invalid(key);
  return { ...inventoryPagination(query), ...(query.ingredientId === undefined ? {} : { ingredientId: objectId(query.ingredientId) }) };
}
