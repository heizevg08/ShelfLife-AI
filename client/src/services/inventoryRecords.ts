import { apiClient } from './apiClient';

export type RecordKind = 'usage-records' | 'waste-records';
export type InventoryRecord = { id: string; ingredientId: string; batchId: string; quantity: string; unit: string; unitCostSnapshot: string; totalCostSnapshot: string; recordedBy: string; recordedAt: string; notes: string; reason?: string; correctionOf?: string; type: 'original' | 'correction'; isActive: boolean; version: number; createdAt: string; updatedAt: string };
export type EligibleBatch = { id: string; ingredientId: string; quantity: string; unit: string; unitCost: string };
export type RecordInput = { ingredientId: string; batchId: string; quantity: string; recordedAt: string; notes?: string; reason?: string };

export const listInventoryRecords = (kind: RecordKind, page = 1, signal?: AbortSignal) => apiClient<{ items: InventoryRecord[]; page: number; limit: number; total: number }>(`/${kind}?page=${page}&limit=25`, { signal });
export const eligibleBatches = (kind: RecordKind, ingredientId: string, signal?: AbortSignal) => apiClient<{ items: EligibleBatch[]; page: number; limit: number; total: number }>(`/${kind}/eligible-batches/${ingredientId}?page=1&limit=100`, { signal });
export const createInventoryRecord = (kind: RecordKind, input: RecordInput) => apiClient<{ record: InventoryRecord }>(`/${kind}`, { method: 'POST', body: JSON.stringify(input) });
export const correctInventoryRecord = (kind: RecordKind, id: string, expectedVersion: number, correctedQuantity: string, reason: string) => apiClient<{ record: InventoryRecord }>(`/${kind}/${id}/corrections`, { method: 'POST', body: JSON.stringify({ expectedVersion, correctedQuantity, reason }) });
export const voidInventoryRecord = (kind: RecordKind, id: string, expectedVersion: number) => apiClient<void>(`/${kind}/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion }) });
export const batchVersion = (id: string) => apiClient<{ batch: { version: number } }>(`/inventory-batches/${id}`);
