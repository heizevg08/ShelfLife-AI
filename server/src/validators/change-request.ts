import { CHANGE_REQUEST_TARGET_FIELDS, CHANGE_REQUEST_TYPES } from '../models/change-request';
import { invalid, objectId } from './administration';
import { calendarDate } from './date';

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export type ChangeRequestInput = { requestType: ChangeRequestType; ingredientId?: string; batchId?: string; targetField: typeof CHANGE_REQUEST_TARGET_FIELDS[number]; reason: string; currentValue?: string; requestedValue?: string };
const TARGETS: Record<ChangeRequestType, readonly ChangeRequestInput['targetField'][]> = {
  BATCH_CORRECTION: ['batchID', 'dateReceived', 'expirationDate', 'unitCost'],
  QUANTITY_ADJUSTMENT: ['quantity'],
  UNIT_CORRECTION: ['unitOfMeasure'],
  ADD_MISSING_BATCH: ['missingBatch'],
  OTHER: ['description'],
};
const text = (field: string, value: unknown, required: boolean, max: number) => { if (typeof value !== 'string') { if (!required && value === undefined) return undefined; invalid(field); } const clean = value.trim().replace(/\s+/g, ' '); if ((required && !clean) || clean.length > max) invalid(field); return clean || undefined; };
export function changeRequestInput(body: unknown): ChangeRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body'); const value = body as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!['requestType', 'ingredientId', 'batchId', 'targetField', 'reason', 'currentValue', 'requestedValue'].includes(key)) invalid(key, 'Field is not permitted');
  if (typeof value.requestType !== 'string' || !CHANGE_REQUEST_TYPES.includes(value.requestType as ChangeRequestType)) invalid('requestType', 'Select a valid request type');
  if (typeof value.targetField !== 'string' || !CHANGE_REQUEST_TARGET_FIELDS.includes(value.targetField as typeof CHANGE_REQUEST_TARGET_FIELDS[number])) invalid('targetField', 'Select a valid correction field');
  const input: ChangeRequestInput = { requestType: value.requestType as ChangeRequestType, targetField: value.targetField as ChangeRequestInput['targetField'], reason: text('reason', value.reason, true, 500)!, ...(value.ingredientId === undefined ? {} : { ingredientId: objectId(value.ingredientId) }), ...(value.batchId === undefined ? {} : { batchId: objectId(value.batchId) }), ...(value.currentValue === undefined ? {} : { currentValue: text('currentValue', value.currentValue, false, 500) }), ...(value.requestedValue === undefined ? {} : { requestedValue: text('requestedValue', value.requestedValue, false, 1000) }) };
  if (!TARGETS[input.requestType].includes(input.targetField)) invalid('targetField', 'Select a correction field that matches the request type');
  const needsBatch = input.requestType === 'BATCH_CORRECTION' || input.requestType === 'QUANTITY_ADJUSTMENT';
  if (needsBatch && (!input.ingredientId || !input.batchId || !input.currentValue || !input.requestedValue)) invalid('batchId');
  if (input.requestType === 'UNIT_CORRECTION' && (!input.ingredientId || !input.currentValue || !input.requestedValue)) invalid('ingredientId');
  if (input.requestType === 'ADD_MISSING_BATCH' && (!input.ingredientId || !input.requestedValue)) invalid('requestedValue');
  if (input.requestType === 'OTHER' && !input.requestedValue) invalid('requestedValue');
  return input;
}
export function changeRequestQuery(query: Record<string, unknown>) { for (const key of Object.keys(query)) if (!['page','pageSize','search','type','status','from','to'].includes(key)) invalid(key); const page=Number(query.page ?? 1), pageSize=Number(query.pageSize ?? 10); if (!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||![10,15,50,100,150].includes(pageSize)) invalid('pageSize'); if (query.type !== undefined && (!CHANGE_REQUEST_TYPES.includes(query.type as ChangeRequestType))) invalid('type'); if (query.status !== undefined && !['PENDING','APPROVED','REJECTED'].includes(String(query.status))) invalid('status'); const from=query.from===undefined?undefined:calendarDate('from',query.from), to=query.to===undefined?undefined:new Date(calendarDate('to',query.to).getTime()+86400000-1); if(from&&to&&from>to) invalid('to','End date must be on or after start date'); return {page,pageSize, ...(typeof query.search==='string'&&query.search.trim()?{search:query.search.trim().slice(0,100)}:{}), ...(query.type?{type:query.type as ChangeRequestType}:{}), ...(query.status?{status:query.status as 'PENDING'|'APPROVED'|'REJECTED'}:{}), ...(from?{from}:{}), ...(to?{to}:{})}; }
export function reviewInput(body: unknown, rejection: boolean) { if(!body||typeof body!=='object'||Array.isArray(body)) invalid('body'); const value=body as Record<string,unknown>; for(const key of Object.keys(value)) if(key!=='reviewNote') invalid(key,'Field is not permitted'); const reviewNote=text('reviewNote',value.reviewNote,rejection,500); return { ...(reviewNote?{reviewNote}:{}) }; }
