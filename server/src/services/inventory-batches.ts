import type { InventoryBatchDisplayStatus, InventoryBatchPageQuery, StockInInput } from '../validators/inventory-batch';
import type { Actor } from './administration';

export interface InventoryBatch {
  id: string;
  batchID: string;
  ingredient: { id: string; name: string; category: string; unitOfMeasure: string; minimumStock?: number };
  quantity: number;
  unit: string;
  dateReceived: string;
  expirationDate: string;
  unitCost?: number;
  persistedStatus?: string;
  displayStatus: InventoryBatchDisplayStatus;
  daysLeft: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface InventoryBatchSummary { totalIngredients: number; totalBatches: number; lowStockItems: number; nearExpiry: number; expiredItems: number; categories: string[] }
export interface StockInSummary { totalBatches: number; stockInToday: number; ingredientsReceivedToday: number; batchesReceivedThisMonth: number; expiringSoonBatches: number }
export interface InventoryBatchStore {
  ready(): Promise<void>;
  list(query: InventoryBatchPageQuery, now: Date): Promise<{ items: InventoryBatch[]; page: number; pageSize: number; total: number }>;
  detail(id: string, now: Date): Promise<InventoryBatch | null>;
  summary(now: Date): Promise<InventoryBatchSummary>;
  stockInSummary(now: Date): Promise<StockInSummary>;
  create(actor: Actor, input: StockInInput): Promise<InventoryBatch | null>;
}
export function createInventoryBatches(store: InventoryBatchStore, now: () => Date = () => new Date()) {
  return {
    list: (query: InventoryBatchPageQuery) => store.list(query, now()),
    detail: (id: string) => store.detail(id, now()),
    summary: () => store.summary(now()),
    stockInSummary: () => store.stockInSummary(now()),
    create: (actor: Actor, input: StockInInput) => store.create(actor, input),
    ready: () => store.ready(),
  };
}
export type InventoryBatchService = ReturnType<typeof createInventoryBatches>;
