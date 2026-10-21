import type { InventoryBatch } from '../services/inventory-batches';

/** Active batch alert fields used by the inventory alert table. */
export type InventoryAlertRecord = {
  id: string;
  date: string;
  ingredient: string;
  category: 'Expiring Soon' | 'Low Stock';
  details: string;
  detailSummary: string;
  batchID: string;
  priority: 'High' | 'Medium';
  status: 'Active';
  batchStatus: 'Expired' | 'Near Expiry' | 'Low Stock';
  daysLeft: number;
};

/**
 * Put expired, near-expiry, then low-stock batches in a stable alert order.
 * @param batches - Inventory batches with server-derived display status.
 * @returns Active alert rows sorted by urgency and ingredient.
 */
export function inventoryAlertRecords(batches: InventoryBatch[]): InventoryAlertRecord[] {
  const formatQty = (quantity: number) => Number(quantity.toFixed(2)).toLocaleString('en-PH');
  return batches.flatMap((batch): InventoryAlertRecord[] => {
    const batchStatus = batch.displayStatus;
    // A depleted batch holds nothing to use, so it is not an alert.
    if (batchStatus === 'In Stock' || batchStatus === 'No Stock') return [];
    const quantity = `${formatQty(batch.quantity)} ${batch.unit}`;
    const expiry = batchStatus === 'Expired' || batchStatus === 'Near Expiry';
    return [{
      id: `${batchStatus}:${batch.id}`,
      date: expiry ? batch.expirationDate : batch.updatedAt || batch.createdAt,
      ingredient: batch.ingredient.name,
      category: expiry ? 'Expiring Soon' : 'Low Stock',
      details: batchStatus === 'Expired'
        ? `Expired · ${quantity} remaining (${batch.batchID})`
        : batchStatus === 'Near Expiry'
          ? `${batch.daysLeft}d left · ${quantity} (${batch.batchID})`
          : `${quantity} remaining (Min: ${formatQty(batch.ingredient.minimumStock ?? 0)} ${batch.unit}; ${batch.batchID})`,
      detailSummary: batchStatus === 'Expired'
        ? `Expired · ${quantity} remaining`
        : batchStatus === 'Near Expiry'
          ? `${batch.daysLeft}d left · ${quantity}`
          : `${quantity} remaining · Min: ${formatQty(batch.ingredient.minimumStock ?? 0)} ${batch.unit}`,
      batchID: batch.batchID,
      priority: batchStatus === 'Expired' || (batchStatus === 'Near Expiry' && batch.daysLeft <= 3) ? 'High' : 'Medium',
      status: 'Active',
      batchStatus,
      daysLeft: batch.daysLeft,
    }];
  }).sort((a, b) => {
    const priority = { Expired: 0, 'Near Expiry': 1, 'Low Stock': 2 };
    return priority[a.batchStatus] - priority[b.batchStatus]
      || a.daysLeft - b.daysLeft
      || a.ingredient.localeCompare(b.ingredient)
      || a.id.localeCompare(b.id);
  });
}
