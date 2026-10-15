import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';

export interface UsageRecord {
  id: string;
  dateUsed: string;
  ingredient: { id: string; name: string };
  batch: { id: string; batchID: string };
  quantityUsed: number;
  unit: string;
  recordedBy: { id: string; name: string; firstName?: string; lastName?: string };
  createdAt: string;
}
export interface UsageSummary {
  totalUsageToday: { quantity: number; unit: string } | null;
  usageTotalsByUnitToday: Array<{ quantity: number; unit: string }>;
  usageRecordsToday: number;
  mostUsedIngredient: string | null;
  ingredientsUsedThisWeek: number;
}
export interface UsageInput { ingredientId: string; batchId: string; dateUsed: string; quantityUsed: number }
// Reporting counts are separate from the private ML quantity target.
export interface UsageAnalytics {
  metric: 'record count';
  period: { from: string | null; to: string | null; label: string };
  total: number;
  dailyCounts: { date: string; count: number }[];
  unresolvedIngredientRecords: number;
}
export const getUsageAnalytics = (query: { from?: string; to?: string; ingredientId?: string; category?: string }, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.category) params.set('category', query.category);
  return apiClient<UsageAnalytics>(`/usage-records/analytics${params.size ? `?${params}` : ''}`, { signal });
};

export function listUsageRecords(query: { page: number; pageSize: number; search?: string; ingredientId?: string; from?: string; to?: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiClient<{ items: UsageRecord[]; page: number; pageSize: number; total: number }>(`/usage-records?${params}`, { signal });
}
export const getUsageSummary = (signal?: AbortSignal, businessDate?: string) => apiClient<UsageSummary>(`/usage-records/summary${businessDate ? `?date=${encodeURIComponent(businessDate)}` : ''}`, { signal });
export async function createUsageRecord(input: UsageInput) {
  const result = await apiClient<{ record: UsageRecord }>('/usage-records', { method: 'POST', body: JSON.stringify(input), successMessage: false });
  publishActionFeedback({ kind: 'success', message: 'Usage record saved successfully.' });
  return result.record;
}
export async function createUsageRecords(items: UsageInput[]) {
  const result = await apiClient<{ count: number; records: UsageRecord[] }>('/usage-records/bulk', { method: 'POST', body: JSON.stringify({ items }), successMessage: false });
  publishActionFeedback({ kind: 'success', message: `${result.count} usage ${result.count === 1 ? 'record' : 'records'} saved successfully.` });
  return result.records;
}
