import type { RefObject } from 'react';
import { Boxes } from 'lucide-react';
import type { ManagerInventoryBatch } from '../../services/inventoryManagerAdapter';
import { formatDecimal, statusTone } from '../../services/inventoryManagerAdapter';
import { Dialog } from './Dialog';
import { Status } from './primitives';

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus }: {
  batch: ManagerInventoryBatch | null;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  return <Dialog open={Boolean(batch)} title="Inventory batch details" onDismiss={onDismiss} returnFocus={returnFocus}
    actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>}>
    {batch && <div className="sl-detail-grid">
      <span><small>Ingredient</small><strong>{batch.ingredient?.name ?? 'Archived or unavailable ingredient'}</strong></span>
      <span><small>Batch code</small><strong>{batch.batchCode}</strong></span>
      <span><small>Current stock</small><strong>{formatDecimal(batch.quantity)} {batch.unit}</strong></span>
      <span><small>Unit cost</small><strong>₱{formatDecimal(batch.unitCost)}</strong></span>
      <span><small>Date received</small><strong>{batch.dateReceived}</strong></span>
      <span><small>Expiration date</small><strong>{batch.expirationDate} · {batch.daysLeft} days left</strong></span>
      <span><small>Status</small><Status tone={statusTone(batch.status)}>{batch.status}</Status></span>
      <span><small>Created by</small><strong>{batch.createdBy}</strong></span>
    </div>}
  </Dialog>;
}
