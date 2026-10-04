import type { RefObject } from 'react';
import { AlertTriangle, Boxes, Trash2 } from 'lucide-react';
import type { InventoryBatch, InventoryBatchDisplayStatus } from '../../services/inventory-batches';
import { inventoryBatchRecorderLabel } from '../../utils/inventory-batch-recorder';
import { formatDate } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApplicationModal } from './ApplicationModal';
import { Status } from './primitives';

const statusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired'
  ? 'critical' as const
  : status === 'Near Expiry' || status === 'Low Stock'
    ? 'attention' as const
    : 'success' as const;

export const inventoryBatchExpirationContext = (daysLeft: number) => daysLeft < 0
  ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} ago`
  : daysLeft === 0 ? 'Expires today' : `in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;

export const inventoryBatchRequiresWaste = (batch: Pick<InventoryBatch, 'displayStatus' | 'quantity'>) => batch.displayStatus === 'Expired' && batch.quantity > 0;

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus, inventoryStaff = false, onRecordWaste }: {
  batch: InventoryBatch | null;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  inventoryStaff?: boolean;
  onRecordWaste?: (batch: InventoryBatch) => void;
}) {
  const ingredient = batch ? formatHumanReadableText(batch.ingredient.name) : '—';
  const requiresWaste = Boolean(batch && inventoryBatchRequiresWaste(batch));
  const actions = <><button type="button" className="sl-button" onClick={onDismiss}>Close</button>{requiresWaste && batch && onRecordWaste && <button type="button" className="sl-button sl-button-danger" onClick={() => onRecordWaste(batch)}><Trash2 size={16} aria-hidden="true" />Record waste</button>}</>;
  return <ApplicationModal open={Boolean(batch)} title={inventoryStaff ? 'Inventory batch details' : 'Inventory Batch Details'} subtitle="View inventory batch information." Icon={Boxes} onDismiss={onDismiss} returnFocus={returnFocus} showClose={false} className={inventoryStaff ? 'sl-inventory-batch-details-dialog sl-staff-inventory-batch-details-dialog' : 'sl-inventory-batch-details-dialog'} actions={actions}>
    {batch && <div className="sl-batch-details-content">
      <section className="sl-batch-details-identity"><div><h3>{ingredient}</h3><span className="sl-canonical-identifier">{batch.batchID}</span></div>{(!inventoryStaff || batch.displayStatus !== 'Expired') && <Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status>}</section>
      {inventoryStaff && requiresWaste && <div className="sl-staff-batch-expired-warning" role="note"><AlertTriangle size={18} aria-hidden="true" /><span><strong>{batch.quantity.toLocaleString()} {batch.unit}</strong> is still in stock and needs to be recorded as waste.</span></div>}
      <dl className="sl-batch-details-primary"><div><dt>Current Stock</dt><dd>{batch.quantity.toLocaleString()} {batch.unit}</dd></div><div><dt>{inventoryStaff && batch.displayStatus === 'Expired' ? 'Expired' : 'Expiration'}</dt><dd>{formatDate(batch.expirationDate)} <small>{inventoryBatchExpirationContext(batch.daysLeft)}</small></dd></div></dl>
      <dl className="sl-batch-details-secondary"><div><dt>Received</dt><dd>{formatDate(batch.dateReceived)}</dd></div><div><dt>Recorded by</dt><dd>{inventoryBatchRecorderLabel(batch.createdBy)}</dd></div></dl>
    </div>}
  </ApplicationModal>;
}
