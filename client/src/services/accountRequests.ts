import { apiClient } from './apiClient';
import type { SessionUser } from './auth';

export interface AccountRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Exclude<SessionUser['role'], 'Super Admin'>;
  requestedBy: { id: string; name: string; role: SessionUser['role'] };
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy: { id: string; name: string } | null;
  reviewNote: string;
  accountId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type AccountRequestInput = Pick<AccountRequest, 'firstName' | 'lastName' | 'email' | 'role'>;

export const listAccountRequests = (signal?: AbortSignal) => apiClient<{ items: AccountRequest[]; total: number }>('/account-requests', { signal });
export const createAccountRequest = (input: AccountRequestInput) => apiClient<{ request: AccountRequest }>('/account-requests', { method: 'POST', body: JSON.stringify(input) });
export const reviewAccountRequest = (id: string, decision: 'Approved' | 'Rejected', expectedVersion: number, note = '') => apiClient<{ request: AccountRequest }>(`/account-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, expectedVersion, note }) });
export const deleteAccountRequest = (id: string) => apiClient<void>(`/account-requests/${id}`, { method: 'DELETE' });
