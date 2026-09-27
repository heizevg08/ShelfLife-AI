import { apiClient } from './apiClient';

export interface ChangeRequest {
  id: string;
  target: string;
  type: string;
  proposedCorrection: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export type ChangeRequestInput = Pick<ChangeRequest, 'target' | 'type' | 'proposedCorrection' | 'reason'>;

export const listChangeRequests = (signal?: AbortSignal) => apiClient<{ items: ChangeRequest[]; total: number }>('/change-requests', { signal });
export const createChangeRequest = (input: ChangeRequestInput) => apiClient<{ request: ChangeRequest }>('/change-requests', { method: 'POST', body: JSON.stringify(input) });
export const updateChangeRequest = (id: string, input: ChangeRequestInput, expectedVersion: number) => apiClient<{ request: ChangeRequest }>(`/change-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedVersion }) });
export const deleteChangeRequest = (id: string) => apiClient<void>(`/change-requests/${id}`, { method: 'DELETE' });