import { apiClient } from './apiClient';
import { publishActionFeedback } from './actionFeedback';

export type WasteReason = 'Expired' | 'Spoiled' | 'Damaged' | 'Over-prepared' | 'Other';
export interface WasteRecord {
  id: string; dateWasted: string; ingredient: { id: string; name: string }; batch: { id: string; batchID: string };
  quantityWasted: number; unit: string; reason: WasteReason; wasteCost: number; recordedBy: { id: string; name: string }; createdAt: string;
}
export interface WasteSummary {
  totalWasteToday: { quantity: number; unit: string } | null;
  wasteRecordsToday: number; mostWastedIngredient: string | null; commonWasteReason: WasteReason | null; totalWasteCostToday: number;
}
export interface WasteInput { ingredientId: string; batchId: string; quantityWasted: number; reason: WasteReason; dateWasted: string }

export function listWasteRecords(query: { page: number; pageSize: number; search?: string; reason?: WasteReason; ingredientId?: string; from?: string; to?: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) params.set('search', query.search);
  if (query.reason) params.set('reason', query.reason);
  if (query.ingredientId) params.set('ingredientId', query.ingredientId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return apiClient<{ items: WasteRecord[]; page: number; pageSize: number; total: number }>(`/waste-records?${params}`, { signal });
}
export const getWasteSummary = (signal?: AbortSignal) => apiClient<WasteSummary>('/waste-records/summary', { signal });
export async function createWasteRecord(input: WasteInput) {
  const result = await apiClient<{ record: WasteRecord }>('/waste-records', { method: 'POST', body: JSON.stringify(input), successMessage: false });
  publishActionFeedback({ kind: 'success', message: 'Waste record saved successfully.' });
  return result.record;
}
