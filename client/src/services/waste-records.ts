import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';

export type WasteReason = 'Expired' | 'Spoiled' | 'Damaged' | 'Over-prepared' | 'Other';

export interface WasteRecord {
  id: string;
  dateWasted: string;
  ingredient: { id: string; name: string };
  batch: { id: string; batchID: string };
  quantityWasted: number;
  unit: string;
  reason: WasteReason;
  wasteCost: number;
  recordedBy: { id: string; name: string; firstName?: string; lastName?: string };
  createdAt: string;
}

export interface WasteSummary {
  totalWasteToday: { quantity: number; unit: string } | null;
  wasteRecordsToday: number;
  mostWastedIngredient: string | null;
  commonWasteReason: WasteReason | null;
  totalWasteCostToday: number;
}

export interface WasteInput {
  ingredientId: string;
  batchId: string;
  quantityWasted: number;
  reason: WasteReason;
  dateWasted: string;
}

// Reporting counts are separate from the private ML quantity target.
export interface WasteAnalytics {
  metric: 'record count';
  period: { from: string | null; to: string | null; label: string };
  total: number;
  dailyCounts: { date: string; count: number }[];
  byReason: Record<WasteReason, number>;
  topIngredients: { ingredientId: string; name: string; count: number }[];
  unresolvedIngredientRecords: number;
}

export const getWasteAnalytics = (
  query: { from?: string; to?: string; ingredientId?: string; category?: string },
  signal?: AbortSignal
) => {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.category) params.set('category', query.category);
  return apiClient<WasteAnalytics>(`/waste-records/analytics${params.size ? `?${params}` : ''}`, { signal });
};

export function listWasteRecords(
  query: { page: number; pageSize: number; search?: string; reason?: WasteReason; ingredientId?: string; from?: string; to?: string },
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.reason) params.set('reason', query.reason);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiClient<{ items: WasteRecord[]; page: number; pageSize: number; total: number }>(
    `/waste-records?${params}`,
    { signal }
  );
}

export const getWasteSummary = (signal?: AbortSignal) =>
  apiClient<WasteSummary>('/waste-records/summary', { signal });

export async function createWasteRecord(input: WasteInput) {
  const result = await apiClient<{ record: WasteRecord }>('/waste-records', {
    method: 'POST',
    body: JSON.stringify(input),
    successMessage: false,
  });
  publishActionFeedback({ kind: 'success', message: 'Waste record saved successfully.' });
  return result.record;
}

export async function createWasteRecords(items: WasteInput[]) {
  const result = await apiClient<{ count: number; records: WasteRecord[] }>('/waste-records/bulk', {
    method: 'POST',
    body: JSON.stringify({ items }),
    successMessage: false,
  });
  publishActionFeedback({
    kind: 'success',
    message: `${result.count} waste ${result.count === 1 ? 'record' : 'records'} saved successfully.`,
  });
  return result.records;
}
