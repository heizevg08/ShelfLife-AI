import type { RefObject } from 'react';
import { Boxes } from 'lucide-react';
import type { InventoryBatch, InventoryBatchDisplayStatus } from '../../services/inventory-batches';
import { formatDate } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApplicationDetailsDialog } from './ApplicationDetailsDialog';
import { Status } from './primitives';

const statusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired'
  ? 'critical' as const
  : status === 'Near Expiry' || status === 'Low Stock'
    ? 'attention' as const
    : 'success' as const;

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus, humanizeIngredient = false }: {
  batch: InventoryBatch | null;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  humanizeIngredient?: boolean;
}) {
  return <ApplicationDetailsDialog open={Boolean(batch)} title="Inventory Batch Details" subtitle="View inventory batch information." Icon={Boxes} identityTitle={batch?.batchID ?? '—'} identityBadge={batch ? humanizeIngredient ? formatHumanReadableText(batch.ingredient.name) : batch.ingredient.name : '—'} sectionTitle="Batch Information" rows={batch ? [
    { label: 'Date Received', value: formatDate(batch.dateReceived) }, { label: 'Expiration Date', value: formatDate(batch.expirationDate) },
    { label: 'Current Stock', value: `${batch.quantity.toLocaleString()} ${batch.unit}` }, { label: 'Days Left', value: batch.daysLeft },
    { label: 'Status', value: <Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status> }, { label: 'Recorded By', value: batch.createdBy.name },
  ] : []} onDismiss={onDismiss} returnFocus={returnFocus} className="sl-inventory-batch-details-dialog" />;
}
