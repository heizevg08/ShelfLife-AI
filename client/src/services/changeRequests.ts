import { apiClient } from './apiClient';

export type ChangeRequestType = 'MINIMUM_STOCK_CHANGE' | 'STANDARD_UNIT_COST_CHANGE' | 'CATEGORY_CHANGE' | 'BRAND_CHANGE' | 'DESCRIPTION_CHANGE' | 'UNIT_OF_MEASURE_CHANGE' | 'DEFAULT_SHELF_LIFE_CHANGE';
export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;
export interface ChangeRequest {
  id: string; schemaVersion: 2 | null; requestID: string | null; requestType: ChangeRequestType | string; ingredientId: string | null;
  targetField: string | null; reason: string; currentValue: string; requestedValue: string; ingredientVersion: number | null;
  status: ChangeRequestStatus; requestedBy: string | null; reviewedBy?: string; reviewedAt?: string; reviewNote?: string;
  version: number; createdAt: string; updatedAt: string; readOnly: boolean;
}
export interface ChangeRequestInput { requestType: ChangeRequestType; ingredientId: string; requestedValue: string; reason: string }
export interface ChangeRequestPage { items: ChangeRequest[]; page: number; limit: number; total: number }
export interface ChangeRequestSummary { total: number; pending: number; approved: number; rejected: number }
export interface ChangeRequestIngredient { id: string; name: string; category: string; unitOfMeasure: string; version: number }

export const listChangeRequests = (query = '', signal?: AbortSignal) => apiClient<ChangeRequestPage>(`/change-requests${query}`, { signal });
export const getChangeRequest = (id: string, signal?: AbortSignal) => apiClient<{ request: ChangeRequest }>(`/change-requests/${encodeURIComponent(id)}`, { signal });
export const getStaffChangeRequestSummary = (signal?: AbortSignal) => apiClient<ChangeRequestSummary>('/change-requests/summary', { signal });
export const getManagerChangeRequestSummary = (signal?: AbortSignal) => apiClient<ChangeRequestSummary>('/change-requests/manager-summary', { signal });
export const listChangeRequestIngredients = (signal?: AbortSignal) => apiClient<{ items: ChangeRequestIngredient[] }>('/change-requests/ingredient-options', { signal });
export const createChangeRequest = (input: ChangeRequestInput) => apiClient<{ request: ChangeRequest }>('/change-requests', { method: 'POST', body: JSON.stringify(input) });
export const approveChangeRequest = (id: string, expectedVersion: number, reviewNote = '') => apiClient<{ request: ChangeRequest }>(`/change-requests/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ expectedVersion, ...(reviewNote ? { reviewNote } : {}) }) });
export const rejectChangeRequest = (id: string, expectedVersion: number, reviewNote: string) => apiClient<{ request: ChangeRequest }>(`/change-requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ expectedVersion, reviewNote }) });
