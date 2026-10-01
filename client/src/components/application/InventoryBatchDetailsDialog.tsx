import type { RefObject } from 'react';
import { Boxes } from 'lucide-react';
import type { InventoryBatch, InventoryBatchDisplayStatus } from '../../services/inventory-batches';
import { formatDate } from '../../utils/date-time';
import { Dialog } from './Dialog';
import { Status } from './primitives';

const statusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired'
  ? 'critical' as const
  : status === 'Near Expiry' || status === 'Low Stock'
    ? 'attention' as const
    : 'success' as const;

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus }: {
  batch: InventoryBatch | null;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  return <Dialog
    open={Boolean(batch)}
    showClose={false}
    title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Boxes size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Inventory Batch Details</span><small>View inventory batch information.</small></span></span>}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>}
    className="sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog sl-inventory-batch-details-dialog"
  >
    {batch && <div className="sl-ingredient-details"><section className="sl-ingredient-details-identity"><div><h3>{batch.batchID}</h3><span className="sl-application-role-pill sl-account-details-role">{batch.ingredient.name}</span></div></section><section className="sl-ingredient-details-information"><h3>Batch Information</h3><dl className="sl-ingredient-details-grid">
      <div><dt>Date Received</dt><dd>{formatDate(batch.dateReceived)}</dd></div><div><dt>Expiration Date</dt><dd>{formatDate(batch.expirationDate)}</dd></div>
      <div><dt>Current Stock</dt><dd>{batch.quantity.toLocaleString()} {batch.unit}</dd></div><div><dt>Days Left</dt><dd>{batch.daysLeft}</dd></div>
      <div><dt>Status</dt><dd><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></dd></div><div><dt>Recorded By</dt><dd>{batch.createdBy.name}</dd></div>
    </dl></section></div>}
  </Dialog>;
}
