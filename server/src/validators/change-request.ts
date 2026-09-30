import { CHANGE_REQUEST_TARGET_FIELDS, CHANGE_REQUEST_TYPES } from '../models/change-request';
import { invalid, objectId } from './administration';
import { calendarDate } from './date';

export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export const CHANGE_REQUEST_UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle', 'can', 'tray'] as const;
type ProposedBatch = { dateReceived: Date; quantityReceived: number; expirationDate: Date; unitCost?: number };
export type ChangeRequestInput = { requestType: ChangeRequestType; ingredientId?: string; batchId?: string; targetField?: typeof CHANGE_REQUEST_TARGET_FIELDS[number]; reason: string; requestedValue?: string; requestedQuantity?: number; requestedUnit?: string; requestDescription?: string; proposedBatch?: ProposedBatch };
const text = (field: string, value: unknown, required: boolean, max: number) => { if (typeof value !== 'string') { if (!required && value === undefined) return undefined; invalid(field); } const clean = value.trim().replace(/\s+/g, ' '); if ((required && !clean) || clean.length > max) invalid(field); return clean || undefined; };
const number = (field: string, value: unknown, required: boolean) => { if (value === undefined && !required) return undefined; if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) invalid(field); return value; };
const permitted: Record<ChangeRequestType, readonly string[]> = {
  BATCH_CORRECTION: ['requestType','ingredientId','batchId','targetField','requestedValue','reason'],
  QUANTITY_ADJUSTMENT: ['requestType','ingredientId','batchId','requestedQuantity','reason'],
  UNIT_CORRECTION: ['requestType','ingredientId','requestedUnit','reason'],
  ADD_MISSING_BATCH: ['requestType','ingredientId','proposedBatch','reason'],
  OTHER: ['requestType','ingredientId','requestDescription','reason'],
};
export function changeRequestInput(body: unknown): ChangeRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body'); const value = body as Record<string, unknown>;
  if (typeof value.requestType !== 'string' || !CHANGE_REQUEST_TYPES.includes(value.requestType as ChangeRequestType)) invalid('requestType', 'Select a valid request type');
  const requestType = value.requestType as ChangeRequestType;
  for (const key of Object.keys(value)) if (!permitted[requestType].includes(key)) invalid(key, 'Field is not permitted');
  const reason = text('reason', value.reason, true, 500)!;
  if (requestType === 'BATCH_CORRECTION') {
    const targetField = value.targetField; if (typeof targetField !== 'string' || !CHANGE_REQUEST_TARGET_FIELDS.includes(targetField as typeof CHANGE_REQUEST_TARGET_FIELDS[number])) invalid('targetField', 'Select a valid batch detail');
    return { requestType, ingredientId: objectId(value.ingredientId), batchId: objectId(value.batchId), targetField: targetField as typeof CHANGE_REQUEST_TARGET_FIELDS[number], requestedValue: text('requestedValue', value.requestedValue, true, 1000), reason };
  }
  if (requestType === 'QUANTITY_ADJUSTMENT') return { requestType, ingredientId: objectId(value.ingredientId), batchId: objectId(value.batchId), requestedQuantity: number('requestedQuantity', value.requestedQuantity, true), reason };
  if (requestType === 'UNIT_CORRECTION') { const requestedUnit = text('requestedUnit', value.requestedUnit, true, 50)!; if (!CHANGE_REQUEST_UNITS.includes(requestedUnit as typeof CHANGE_REQUEST_UNITS[number])) invalid('requestedUnit', 'Select a valid unit'); return { requestType, ingredientId: objectId(value.ingredientId), requestedUnit, reason }; }
  if (requestType === 'ADD_MISSING_BATCH') { const proposal = value.proposedBatch; if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) invalid('proposedBatch'); const p = proposal as Record<string, unknown>; for (const key of Object.keys(p)) if (!['dateReceived','quantityReceived','expirationDate','unitCost'].includes(key)) invalid(`proposedBatch.${key}`, 'Field is not permitted'); const dateReceived = calendarDate('dateReceived', p.dateReceived); const expirationDate = calendarDate('expirationDate', p.expirationDate); if (expirationDate <= dateReceived) invalid('expirationDate', 'Expiration date must be after date received'); const unitCost = p.unitCost === undefined ? undefined : (typeof p.unitCost !== 'number' || !Number.isFinite(p.unitCost) || p.unitCost < 0 ? invalid('unitCost') : p.unitCost); return { requestType, ingredientId: objectId(value.ingredientId), proposedBatch: { dateReceived, quantityReceived: number('quantityReceived', p.quantityReceived, true)!, expirationDate, ...(unitCost === undefined ? {} : { unitCost }) }, reason }; }
  return { requestType, ...(value.ingredientId === undefined ? {} : { ingredientId: objectId(value.ingredientId) }), requestDescription: text('requestDescription', value.requestDescription, true, 1000), reason };
}
export function changeRequestQuery(query: Record<string, unknown>) { for (const key of Object.keys(query)) if (!['page','pageSize','search','type','status','from','to'].includes(key)) invalid(key); const page=Number(query.page ?? 1), pageSize=Number(query.pageSize ?? 10); if (!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||![10,15,50,100,150].includes(pageSize)) invalid('pageSize'); if (query.type !== undefined && (!CHANGE_REQUEST_TYPES.includes(query.type as ChangeRequestType))) invalid('type'); if (query.status !== undefined && !['PENDING','APPROVED','REJECTED'].includes(String(query.status))) invalid('status'); const from=query.from===undefined?undefined:calendarDate('from',query.from), to=query.to===undefined?undefined:new Date(calendarDate('to',query.to).getTime()+86400000-1); if(from&&to&&from>to) invalid('to','End date must be on or after start date'); return {page,pageSize, ...(typeof query.search==='string'&&query.search.trim()?{search:query.search.trim().slice(0,100)}:{}), ...(query.type?{type:query.type as ChangeRequestType}:{}), ...(query.status?{status:query.status as 'PENDING'|'APPROVED'|'REJECTED'}:{}), ...(from?{from}:{}), ...(to?{to}:{})}; }
export function reviewInput(body: unknown, rejection: boolean) { if(!body||typeof body!=='object'||Array.isArray(body)) invalid('body'); const value=body as Record<string,unknown>; for(const key of Object.keys(value)) if(key!=='reviewNote') invalid(key,'Field is not permitted'); const reviewNote=text('reviewNote',value.reviewNote,rejection,500); return { ...(reviewNote?{reviewNote}:{} )}; }
