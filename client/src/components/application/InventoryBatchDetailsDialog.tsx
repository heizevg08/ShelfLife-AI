import type { RefObject } from 'react';
import { Boxes } from 'lucide-react';
import type { InventoryBatch, InventoryBatchDisplayStatus } from '../../services/inventory-batches';
import { formatDate } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApplicationModal } from './ApplicationModal';
import { Status } from './primitives';

const statusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired'
  ? 'critical' as const
  : status === 'Near Expiry' || status === 'Low Stock'
    ? 'attention' as const
    : 'success' as const;

const expirationContext = (daysLeft: number) => daysLeft < 0
  ? `Expired ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} ago`
  : daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`;

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus }: {
  batch: InventoryBatch | null;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const ingredient = batch ? formatHumanReadableText(batch.ingredient.name) : '—';
  return <ApplicationModal open={Boolean(batch)} title="Inventory Batch Details" subtitle="View inventory batch information." Icon={Boxes} onDismiss={onDismiss} returnFocus={returnFocus} showClose={false} className="sl-inventory-batch-details-dialog" actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>}>
    {batch && <div className="sl-batch-details-content">
      <section className="sl-batch-details-identity"><div><h3>{ingredient}</h3><span className="sl-canonical-identifier">{batch.batchID}</span></div><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></section>
      <dl className="sl-batch-details-primary"><div><dt>Current Stock</dt><dd>{batch.quantity.toLocaleString()} {batch.unit}</dd></div><div><dt>Expires</dt><dd>{formatDate(batch.expirationDate)} <small>{expirationContext(batch.daysLeft)}</small></dd></div></dl>
      <dl className="sl-batch-details-secondary"><div><dt>Received</dt><dd>{formatDate(batch.dateReceived)}</dd></div><div><dt>Recorded by</dt><dd>{batch.createdBy.name || '—'}</dd></div></dl>
    </div>}
  </ApplicationModal>;
}
