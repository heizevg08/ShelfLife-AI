import type { RefObject } from 'react';
import { FileInput } from 'lucide-react';
import type { ChangeRequest, ChangeRequestType } from '../../services/change-requests';
import { formatDate, formatDateTime } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { InventoryStaffModal } from './InventoryStaffModal';

const TYPE_LABELS: Record<ChangeRequestType, string> = { BATCH_CORRECTION: 'Batch Correction', QUANTITY_ADJUSTMENT: 'Quantity Adjustment', UNIT_CORRECTION: 'Unit Correction', ADD_MISSING_BATCH: 'Add Missing Batch', OTHER: 'Other' };
const TARGET_LABELS: Record<string, string> = { dateReceived: 'Date Received', expirationDate: 'Expiration Date', unitCost: 'Unit Cost' };
const unavailable = '\u2014';
type DetailRow = { label: string; value: string; span?: boolean };

const quantityParts = (request: ChangeRequest) => { const match = request.currentValue?.trim().match(/^(.+?)\s+([^\s]+)$/); return { current: request.currentValue ?? unavailable, unit: match?.[2] ?? request.batch?.unit, requested: request.requestedQuantity }; };
export function formatChangeRequestSummary(request: ChangeRequest) {
  return formatHumanReadableText(request.reason);
}

function detailRows(request: ChangeRequest) {
  const dateValue = (value?: string) => value ? formatDate(value) : unavailable;
  const status = request.status === 'PENDING' ? 'Pending Review' : request.status[0] + request.status.slice(1).toLowerCase();
  const rows: DetailRow[] = [];
  if (request.requestType === 'OTHER') {
    rows.push({ label: 'Submitted On', value: formatDateTime(request.createdAt) }, { label: 'Status', value: status });
    if (request.ingredient) rows.push({ label: 'Inventory Target', value: request.ingredient.name, span: true });
    if (request.requestDescription) rows.push({ label: 'Request Description', value: request.requestDescription, span: true });
  } else {
    if (request.ingredient) rows.push({ label: 'Ingredient', value: request.ingredient.name });
    if (request.batch) rows.push({ label: 'Batch ID', value: request.batch.batchID });
    rows.push({ label: 'Submitted On', value: formatDateTime(request.createdAt) }, { label: 'Status', value: status, span: !request.batch && request.requestType === 'UNIT_CORRECTION' });
    if (request.requestType === 'BATCH_CORRECTION') rows.push(
      { label: 'Detail to Correct', value: TARGET_LABELS[request.targetField ?? ''] ?? unavailable, span: true },
      { label: 'Current Value', value: request.targetField === 'dateReceived' || request.targetField === 'expirationDate' ? dateValue(request.currentValue) : request.currentValue ?? unavailable },
      { label: 'Requested Value', value: request.targetField === 'dateReceived' || request.targetField === 'expirationDate' ? dateValue(request.requestedValue) : request.requestedValue ?? unavailable },
    );
    if (request.requestType === 'QUANTITY_ADJUSTMENT') { const { current, unit, requested } = quantityParts(request); rows.push({ label: 'Current Quantity', value: current }, { label: 'Requested Quantity', value: requested === undefined ? unavailable : `${requested}${unit ? ` ${unit}` : ''}` }); }
    if (request.requestType === 'UNIT_CORRECTION') rows.push({ label: 'Current Unit', value: request.currentValue ?? unavailable }, { label: 'Requested Unit', value: request.requestedUnit ?? unavailable });
    if (request.requestType === 'ADD_MISSING_BATCH' && request.proposedBatch) {
      const unit = request.currentValue?.trim();
      rows.push(
        { label: 'Date Received', value: formatDate(request.proposedBatch.dateReceived) },
        { label: 'Quantity Received', value: `${request.proposedBatch.quantityReceived}${unit ? ` ${unit}` : ''}` },
        { label: 'Expiration Date', value: formatDate(request.proposedBatch.expirationDate) },
      );
      if (request.proposedBatch.unitCost !== undefined) rows.push({ label: 'Unit Cost', value: String(request.proposedBatch.unitCost), span: true });
    }
  }
  rows.push({ label: 'Reason', value: formatHumanReadableText(request.reason), span: true });
  if (request.reviewedBy) rows.push({ label: 'Reviewed By', value: request.reviewedBy.name });
  if (request.reviewedAt) rows.push({ label: 'Reviewed On', value: formatDateTime(request.reviewedAt) });
  if (request.reviewNote) rows.push({ label: 'Review Notes', value: request.reviewNote, span: true });
  return rows;
}

function layoutDetailRows(rows: DetailRow[]) {
  let column = 0;
  let gridRow = 0;
  return rows.map(row => {
    const side = row.span ? 'full' : column === 0 ? 'left' : 'right';
    const firstRow = gridRow === 0;
    if (row.span) { column = 0; gridRow += 1; }
    else if (column === 0) column = 1;
    else { column = 0; gridRow += 1; }
    return { ...row, side, firstRow };
  });
}

export function ChangeRequestDetailsDialog({ request, onDismiss, returnFocus }: { request: ChangeRequest | null; onDismiss: () => void; returnFocus: RefObject<HTMLElement | null> }) {
  return <InventoryStaffModal open={Boolean(request)} title="Change Request Details" subtitle="Review the request and its current decision." Icon={FileInput} onDismiss={onDismiss} returnFocus={returnFocus} showClose={false} actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>} className="sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog sl-change-request-details-dialog">{request && <div className="sl-ingredient-details"><section className="sl-ingredient-details-identity"><div><h3>{request.requestID}</h3><span className="sl-application-role-pill sl-account-details-role">{TYPE_LABELS[request.requestType]}</span></div></section><section className="sl-ingredient-details-information"><h3>Request Information</h3><dl className="sl-ingredient-details-grid">{layoutDetailRows(detailRows(request)).map(({ label, value, span, side, firstRow }) => <div key={label} className={`${span ? 'sl-ingredient-details-description ' : ''}sl-change-request-detail-cell sl-change-request-detail-cell--${side}${firstRow ? ' sl-change-request-detail-cell--first-row' : ''}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>}</InventoryStaffModal>;
}
