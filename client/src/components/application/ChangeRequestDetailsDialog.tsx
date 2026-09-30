import type { RefObject } from 'react';
import { FileInput } from 'lucide-react';
import type { ChangeRequest, ChangeRequestType } from '../../services/change-requests';
import { formatDate, formatDateTime } from '../../utils/date-time';
import { InventoryStaffModal } from './InventoryStaffModal';

const TYPE_LABELS: Record<ChangeRequestType, string> = { BATCH_CORRECTION: 'Batch Correction', QUANTITY_ADJUSTMENT: 'Quantity Adjustment', UNIT_CORRECTION: 'Unit Correction', ADD_MISSING_BATCH: 'Add Missing Batch', OTHER: 'Other' };
const TARGET_LABELS: Record<string, string> = { dateReceived: 'Date Received', expirationDate: 'Expiration Date', unitCost: 'Unit Cost' };
const unavailable = '\u2014';

const quantityParts = (request: ChangeRequest) => { const match = request.currentValue?.trim().match(/^(.+?)\s+([^\s]+)$/); return { current: request.currentValue ?? unavailable, unit: match?.[2] ?? request.batch?.unit, requested: request.requestedQuantity }; };
export function formatChangeRequestSummary(request: ChangeRequest) {
  if (request.requestType !== 'QUANTITY_ADJUSTMENT') return request.reason;
  const { current, unit, requested } = quantityParts(request);
  return `${current} \u2192 ${requested === undefined ? unavailable : `${requested}${unit ? ` ${unit}` : ''}`} · ${request.reason}`;
}

function detailRows(request: ChangeRequest) {
  const dateValue = (value?: string) => value ? formatDate(value) : unavailable;
  const rows: Array<[string, string]> = [['Request ID', request.requestID], ['Request Type', TYPE_LABELS[request.requestType]], ...(request.ingredient ? [['Ingredient', request.ingredient.name] as [string, string]] : []), ...(request.batch ? [['Batch ID', request.batch.batchID] as [string, string]] : []), ['Submitted On', formatDateTime(request.createdAt)]];
  if (request.requestType === 'BATCH_CORRECTION') rows.push(['Detail to Correct', TARGET_LABELS[request.targetField ?? ''] ?? unavailable], ['Current Value', request.targetField === 'dateReceived' || request.targetField === 'expirationDate' ? dateValue(request.currentValue) : request.currentValue ?? unavailable], ['Requested Value', request.targetField === 'dateReceived' || request.targetField === 'expirationDate' ? dateValue(request.requestedValue) : request.requestedValue ?? unavailable]);
  if (request.requestType === 'QUANTITY_ADJUSTMENT') { const { current, unit, requested } = quantityParts(request); rows.push(['Current Quantity', current], ['Requested Quantity', requested === undefined ? unavailable : `${requested}${unit ? ` ${unit}` : ''}`]); }
  if (request.requestType === 'UNIT_CORRECTION') rows.push(['Current Unit', request.currentValue ?? unavailable], ['Requested Unit', request.requestedUnit ?? unavailable]);
  if (request.requestType === 'ADD_MISSING_BATCH' && request.proposedBatch) rows.push(['Date Received', formatDate(request.proposedBatch.dateReceived)], ['Quantity Received', String(request.proposedBatch.quantityReceived)], ['Unit', request.currentValue ?? unavailable], ['Expiration Date', formatDate(request.proposedBatch.expirationDate)], ...(request.proposedBatch.unitCost === undefined ? [] : [['Unit Cost', String(request.proposedBatch.unitCost)] as [string, string]]));
  if (request.requestType === 'OTHER') rows.push(...(request.ingredient ? [['Inventory Target', request.ingredient.name] as [string, string]] : []), ['Request Description', request.requestDescription ?? unavailable]);
  rows.push(['Reason', request.reason], ['Status', request.status === 'PENDING' ? 'Pending Review' : request.status[0] + request.status.slice(1).toLowerCase()]);
  if (request.reviewedBy) rows.push(['Reviewed By', request.reviewedBy.name]);
  if (request.reviewedAt) rows.push(['Reviewed On', formatDateTime(request.reviewedAt)]);
  if (request.reviewNote) rows.push(['Review Notes', request.reviewNote]);
  return rows;
}

export function ChangeRequestDetailsDialog({ request, onDismiss, returnFocus }: { request: ChangeRequest | null; onDismiss: () => void; returnFocus: RefObject<HTMLElement | null> }) {
  return <InventoryStaffModal open={Boolean(request)} title="Change Request Details" subtitle="Review the request and its current decision." Icon={FileInput} onDismiss={onDismiss} returnFocus={returnFocus} showClose={false} actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>} className="sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog sl-change-request-details-dialog">{request && <div className="sl-ingredient-details"><section className="sl-ingredient-details-identity"><div><h3>{request.requestID}</h3><span className="sl-application-role-pill sl-account-details-role">{TYPE_LABELS[request.requestType]}</span></div></section><section className="sl-ingredient-details-information"><h3>Request Information</h3><dl className="sl-ingredient-details-grid">{detailRows(request).filter(([label]) => label !== 'Request ID' && label !== 'Request Type').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>}</InventoryStaffModal>;
}
