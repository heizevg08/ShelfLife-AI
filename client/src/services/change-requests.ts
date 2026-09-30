import { apiClient } from './apiClient';

export const CHANGE_REQUEST_TYPES = ['BATCH_CORRECTION', 'QUANTITY_ADJUSTMENT', 'UNIT_CORRECTION', 'ADD_MISSING_BATCH', 'OTHER'] as const;
export type ChangeRequestType = typeof CHANGE_REQUEST_TYPES[number];
export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface ChangeRequest {
  id: string; requestID: string; requestType: ChangeRequestType; targetField?: string; reason: string; currentValue?: string; requestedValue?: string; requestedQuantity?: number; requestedUnit?: string; requestDescription?: string; proposedBatch?: { dateReceived: string; quantityReceived: number; expirationDate: string; unitCost?: number };
  ingredient?: { id: string; name: string }; batch?: { id: string; batchID: string }; status: ChangeRequestStatus;
  requestedBy: { id: string; name: string }; reviewedBy?: { id: string; name: string }; reviewedAt?: string; reviewNote?: string; createdAt: string; updatedAt: string;
}
export interface ChangeRequestInput { requestType: ChangeRequestType; reason: string; ingredientId?: string; batchId?: string; targetField?: string; requestedValue?: string; requestedQuantity?: number; requestedUnit?: string; requestDescription?: string; proposedBatch?: { dateReceived: string; quantityReceived: number; expirationDate: string; unitCost?: number }; }
export interface ChangeRequestQuery { page: number; pageSize: number; search?: string; type?: ChangeRequestType; status?: ChangeRequestStatus; from?: string; to?: string; }
const query = (value: ChangeRequestQuery) => { const params = new URLSearchParams({ page: String(value.page), pageSize: String(value.pageSize) }); Object.entries(value).forEach(([key, item]) => { if (!['page', 'pageSize'].includes(key) && item) params.set(key, String(item)); }); return params; };
export const listChangeRequests = (value: ChangeRequestQuery, signal?: AbortSignal) => apiClient<{ items: ChangeRequest[]; page: number; pageSize: number; total: number }>(`/change-requests?${query(value)}`, { signal });
export const getChangeRequestSummary = (signal?: AbortSignal) => apiClient<{ totalRequests: number; approved: number; pending: number; rejected: number }>('/change-requests/summary', { signal });
export const getChangeRequest = (id: string, signal?: AbortSignal) => apiClient<{ request: ChangeRequest }>(`/change-requests/${encodeURIComponent(id)}`, { signal }).then(result => result.request);
export const createChangeRequest = (input: ChangeRequestInput) => apiClient<ChangeRequest>('/change-requests', { method: 'POST', body: JSON.stringify(input), successMessage: 'Change request submitted successfully.' });
