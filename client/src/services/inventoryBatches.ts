import { apiClient } from './apiClient';

export type BatchStatus = 'Normal' | 'Approaching Expiry' | 'Critical' | 'Expired';
export interface InventoryBatch {
  id: string;
  ingredientId: string;
  batchCode: string;
  initialQuantity: string;
  quantity: string;
  unit: string;
  unitCost: string;
  currency: 'PHP';
  dateReceived: string;
  expirationDate: string;
  isActive: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: BatchStatus;
}
export interface InventoryBatchSummary {
  totalIngredients: number;
  totalBatches: number;
  lowStockItems: number;
  lowStockExcludedCount: number;
  statusCounts: Record<BatchStatus, number>;
  categoryCounts: Array<{ category: string; batchCount: number; quantity: string; inventoryValue: string }>;
  inventoryValue: string;
}

export const listInventoryBatches = (page = 1, limit = 25, signal?: AbortSignal) =>
  apiClient<{ items: InventoryBatch[]; page: number; limit: number; total: number }>(`/inventory-batches?page=${page}&limit=${limit}`, { signal });
export const inventoryBatchSummary = (signal?: AbortSignal) => apiClient<InventoryBatchSummary>('/inventory-batches/summary', { signal });
