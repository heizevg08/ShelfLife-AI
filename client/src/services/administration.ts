import { apiClient } from './apiClient';
import type { SessionUser } from './auth';

export interface Account extends SessionUser { firstName: string; lastName: string; createdAt: string; updatedAt: string }
export interface AuditRecord { id: string; userId: string; actor: { id: string; name: string; role: string }; action: string; targetType: string; targetId: string; timestamp: string }
export interface AuditFilters { actorRole?: SessionUser['role']; action?: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE'; from?: string; to?: string }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface DashboardSummary { totalUsers: number; activeUsers: number; inactiveUsers: number; roleCounts?: Partial<Record<SessionUser['role'], number>> }
export type AccountFields = Pick<Account, 'firstName' | 'lastName' | 'email' | 'role'>;
export const listAccounts = (page = 1, sortBy = 'createdAt', sortOrder = 'desc', signal?: AbortSignal) => apiClient<Page<Account>>(`/users?page=${page}&pageSize=10&sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`, { signal });
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
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return apiClient<Page<AuditRecord>>(`/audit-records?${query}`, { signal });
};
