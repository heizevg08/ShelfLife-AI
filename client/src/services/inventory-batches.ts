import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';

export type InventoryBatchDisplayStatus = 'In Stock' | 'Low Stock' | 'Near Expiry' | 'Expired';
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
export interface StockInInput { ingredientId: string; dateReceived: string; quantity: number; expirationDate: string; unitCost?: number }

export function listInventoryBatches(query: { page: number; pageSize: number; search?: string; category?: string; status?: InventoryBatchDisplayStatus; ingredientId?: string; from?: string; to?: string; sort?: 'fefo' | 'latest' | 'ingredient' }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.sort) params.set('sort', query.sort);
  return apiClient<{ items: InventoryBatch[]; page: number; pageSize: number; total: number }>(`/inventory-batches?${params}`, { signal });
}
export function getInventoryBatchSummary(signal?: AbortSignal) { return apiClient<InventoryBatchSummary>('/inventory-batches/summary', { signal }); }
export function getInventoryBatch(id: string, signal?: AbortSignal) { return apiClient<{ batch: InventoryBatch }>(`/inventory-batches/${encodeURIComponent(id)}`, { signal }).then(result => result.batch); }
export function getStockInSummary(signal?: AbortSignal) { return apiClient<StockInSummary>('/inventory-batches/stock-in-summary', { signal }); }
export async function createStockIn(input: StockInInput) {
  const result = await apiClient<{ batch: InventoryBatch }>('/inventory-batches', { method: 'POST', body: JSON.stringify(input), successMessage: false });
  publishActionFeedback({ kind: 'success', message: `Stock-In saved successfully. Batch ID: ${result.batch.batchID}` });
  return result.batch;
}
