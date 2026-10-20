import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';
import { downloadFile, type ReportRange } from './report-exports';

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
  createdBy: { id: string; name: string; firstName?: string; lastName?: string };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatchSummary {
  totalIngredients: number;
  totalBatches: number;
  lowStockItems: number;
  nearExpiry: number;
  expiredItems: number;
  inventoryValue: number | null;
  statusCounts: Record<InventoryBatchDisplayStatus, number>;
  categories: string[];
  categoryCounts: Array<{ label: string; value: number }>;
}

export interface StockInSummary {
  totalBatches: number;
  stockInToday: number;
  ingredientsReceivedToday: number;
  batchesReceivedThisMonth: number;
  expiringSoonBatches: number;
}

export interface StockInInput {
  ingredientId: string;
  dateReceived: string;
  quantity: number;
  expirationDate: string;
  unitCost?: number;
}

/**
 * One page of stock batches, optionally filtered and sorted.
 *
 * @param query - page, page size, search text, category, display status, date
 * range and sort order; `eligibleFefo` keeps only batches still usable under
 * first-expired-first-out.
 * @param signal - aborts the request when the filters change again.
 * @returns the page items with the matching total count.
 */
export function listInventoryBatches(
  query: {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    status?: InventoryBatchDisplayStatus;
    ingredientId?: string;
    from?: string;
    to?: string;
    sort?: 'fefo' | 'latest' | 'ingredient';
    eligibleFefo?: true;
  },
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.status) params.set('status', query.status);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.sort) params.set('sort', query.sort);
  if (query.eligibleFefo) params.set('eligibleFefo', 'true');
  return apiClient<{ items: InventoryBatch[]; page: number; pageSize: number; total: number }>(
    `/inventory-batches?${params}`,
    { signal }
  );
}

/**
 * Headline counts, values and category totals for the inventory screens.
 *
 * @returns the inventory summary.
 */
export function getInventoryBatchSummary(signal?: AbortSignal) {
  return apiClient<InventoryBatchSummary>('/inventory-batches/summary', { signal });
}

/**
 * One stock batch with its ingredient, remaining days and display status.
 *
 * @returns the batch.
 * @throws ApiError when the batch no longer exists.
 */
export function getInventoryBatch(id: string, signal?: AbortSignal) {
  return apiClient<{ batch: InventoryBatch }>(`/inventory-batches/${encodeURIComponent(id)}`, { signal }).then(
    result => result.batch
  );
}

/**
 * Stock-In counters for today and the current month.
 *
 * @returns the Stock-In summary.
 */
export function getStockInSummary(signal?: AbortSignal) {
  return apiClient<StockInSummary>('/inventory-batches/stock-in-summary', { signal });
}

/**
 * Download the stock-batch report for a date range as XLSX.
 *
 * @param range - the date range to export; null exports every date.
 */
export function downloadInventoryPeriodXlsx(range: ReportRange) {
  const params = range ? `?${new URLSearchParams(range)}` : '';
  const suffix = range ? `${range.from}-${range.to}` : 'all-dates-all-dates';
  return downloadFile(
    `/inventory-batches/export.xlsx${params}`,
    `inventory-period-report-${suffix}.xlsx`,
    /filename="([a-z0-9-]+\.xlsx)"/i
  );
}

/**
 * Record one stock-in batch and announce its new batch ID.
 *
 * @returns the saved batch.
 * @throws ApiError when validation fails or the ingredient is unknown.
 */
export async function createStockIn(input: StockInInput) {
  const result = await apiClient<{ batch: InventoryBatch }>('/inventory-batches', {
    method: 'POST',
    body: JSON.stringify(input),
    successMessage: false,
  });
  publishActionFeedback({ kind: 'success', message: `Stock-In saved successfully. Batch ID: ${result.batch.batchID}` });
  return result.batch;
}

/**
 * Record several stock-in batches in one request.
 *
 * @returns the saved batches, in submission order.
 * @throws ApiError when any row fails validation.
 */
export async function createStockIns(items: StockInInput[]) {
  const result = await apiClient<{ count: number; batches: InventoryBatch[] }>('/inventory-batches/bulk', {
    method: 'POST',
    body: JSON.stringify({ items }),
    successMessage: false,
  });
  publishActionFeedback({
    kind: 'success',
    message: `${result.count} stock-in ${result.count === 1 ? 'batch' : 'batches'} saved successfully.`,
  });
  return result.batches;
}
