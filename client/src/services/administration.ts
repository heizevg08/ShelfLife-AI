import { apiClient } from './apiClient';
import { apiBaseUrl } from './config';
import type { SessionUser } from './auth';

export interface Account extends SessionUser { firstName: string; lastName: string; lastLoginAt?: string; createdAt: string; updatedAt: string }
export interface AuditRecord { id: string; userId: string; actor: { id: string; name: string; role: string }; action: string; targetType: string; targetId?: string; targetName?: string; module?: string; status?: string; details?: string; timestamp: string }
export interface AuditFilters { actorRole?: SessionUser['role']; action?: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE' | 'EXPORT'; module?: string; status?: 'Success' | 'Failed' | 'Warning'; search?: string; from?: string; to?: string }
export interface AccountFilters { search?: string; role?: SessionUser['role']; status?: 'Active' | 'Deactivated' }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface DashboardSummary { totalUsers: number; activeUsers: number; inactiveUsers: number; roleCounts?: Partial<Record<SessionUser['role'], number>> }
export type AccountFields = Pick<Account, 'firstName' | 'lastName' | 'email' | 'role'>;
export const listAccounts = (page = 1, sortBy = 'createdAt', sortOrder = 'desc', signal?: AbortSignal, pageSize = 10, filters: AccountFilters = {}) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortOrder });
  if (filters.search) query.set('search', filters.search);
  if (filters.role) query.set('role', filters.role);
  if (filters.status) query.set('status', filters.status);
  return apiClient<Page<Account>>(`/users?${query}`, { signal });
};
export const getAccount = (id: string) => apiClient<{ user: Account }>(`/users/${encodeURIComponent(id)}`);
export const createAccount = (fields: AccountFields & { password: string }) => apiClient<{ user: Account }>('/users', { method: 'POST', body: JSON.stringify(fields) });
export const updateAccount = (id: string, fields: AccountFields) => apiClient<{ user: Account }>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(fields) });
export const setAccountActive = (id: string, active: boolean) => apiClient<{ user: Account }>(`/users/${encodeURIComponent(id)}/${active ? 'reactivate' : 'deactivate'}`, { method: 'POST' });
export const accountSummary = (signal?: AbortSignal) => apiClient<DashboardSummary>('/users/summary', { signal });
export const dashboardSummary = (signal?: AbortSignal) => apiClient<DashboardSummary>('/dashboard/summary', { signal });
export const listAuditRecords = (page = 1, pageSize = 25, sortOrder = 'desc', filters: AuditFilters = {}, signal?: AbortSignal) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy: 'timestamp', sortOrder });
  if (filters.actorRole) query.set('actorRole', filters.actorRole);
  if (filters.action) query.set('action', filters.action);
  if (filters.module) query.set('module', filters.module);
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return apiClient<Page<AuditRecord>>(`/audit-records?${query}`, { signal });
};

export async function downloadAuditCsv(filters: AuditFilters, signal?: AbortSignal): Promise<void> {
  const { currentUser } = await import('./auth');
  const { getAccessToken } = await import('./session');
  await currentUser();
  const query = new URLSearchParams();
  for (const key of ['actorRole', 'action', 'module', 'status', 'search', 'from', 'to'] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  const base = apiBaseUrl;
  const response = await fetch(`${base}/api/audit-records/export.csv?${query}`, { credentials: 'include', cache: 'no-store', signal, headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!response.ok) throw new Error('The audit export could not be prepared.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shelflife-audit-records.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
