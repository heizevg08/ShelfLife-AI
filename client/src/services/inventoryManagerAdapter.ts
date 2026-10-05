import type { StockInIngredientOption } from './ingredients';
import type { BatchStatus, InventoryBatch } from './inventoryBatches';

export type ManagerInventoryStatus = BatchStatus;
export type ManagerInventoryBatch = InventoryBatch & {
  ingredient: Pick<StockInIngredientOption, 'id' | 'name' | 'category' | 'unitOfMeasure'> | null;
  daysLeft: number;
};

function manilaDate(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function daysUntilExpiration(expirationDate: string, now = new Date()) {
  return Math.round((Date.parse(`${expirationDate}T00:00:00Z`) - Date.parse(`${manilaDate(now)}T00:00:00Z`)) / 86_400_000);
}
export function adaptInventoryBatch(batch: InventoryBatch, ingredients: readonly StockInIngredientOption[], now = new Date()): ManagerInventoryBatch {
  const source = ingredients.find(ingredient => ingredient.id === batch.ingredientId);
  return {
    ...batch,
    ingredient: source ? { id: source.id, name: source.name, category: source.category, unitOfMeasure: source.unitOfMeasure } : null,
    daysLeft: daysUntilExpiration(batch.expirationDate, now),
  };
}
export function statusTone(status: ManagerInventoryStatus) {
  return status === 'Expired' || status === 'Critical' ? 'critical' as const
    : status === 'Approaching Expiry' ? 'attention' as const : 'success' as const;
}
export function formatDecimal(value: string) {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
export function formatPhp(value: string) { return `₱${formatDecimal(value)}`; }
