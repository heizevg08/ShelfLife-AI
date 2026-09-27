import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';

export interface UsageRecord {
  id: string;
  dateUsed: string;
  ingredient: { id: string; name: string };
  batch: { id: string; batchID: string };
  quantityUsed: number;
  unit: string;
  recordedBy: { id: string; name: string };
  createdAt: string;
}
export interface UsageSummary {
  totalUsageToday: { quantity: number; unit: string } | null;
  usageRecordsToday: number;
  mostUsedIngredient: string | null;
  ingredientsUsedThisWeek: number;
}
export interface UsageInput { ingredientId: string; batchId: string; dateUsed: string; quantityUsed: number }

export function listUsageRecords(query: { page: number; pageSize: number; search?: string; ingredientId?: string; from?: string; to?: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiClient<{ items: UsageRecord[]; page: number; pageSize: number; total: number }>(`/usage-records?${params}`, { signal });
}
export const getUsageSummary = (signal?: AbortSignal) => apiClient<UsageSummary>('/usage-records/summary', { signal });
export async function createUsageRecord(input: UsageInput) {
  const result = await apiClient<{ record: UsageRecord }>('/usage-records', { method: 'POST', body: JSON.stringify(input), successMessage: false });
  publishActionFeedback({ kind: 'success', message: 'Usage record saved successfully.' });
  return result.record;
}
