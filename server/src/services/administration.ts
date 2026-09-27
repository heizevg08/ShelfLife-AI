import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import type { AccountInput, AccountPageQuery, AuditPageQuery } from '../validators/administration';
import { hashPassword } from './password';

export interface Account {
  id: string; firstName: string; lastName: string; name: string; email: string;
  role: string; isActive: boolean; lastLoginAt?: string; createdAt: string; updatedAt: string;
}
export interface Actor { id: string; name?: string; role: string }
export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE' | 'EXPORT';
export interface AuditRecord { id: string; userId: string; actor: { id: string; name: string; role: string }; action: AuditAction; targetType: 'User' | 'Audit Records' | 'InventoryBatch' | 'UsageRecord'; targetId?: string; targetName?: string; module?: string; status?: 'Success' | 'Failed' | 'Warning'; details?: string; timestamp: string }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface AccountTransaction {
  get(id: string): Promise<Account | null>;
  create(input: Omit<AccountInput, 'password'> & { passwordHash: string }): Promise<Account>;
  update(id: string, input: Omit<AccountInput, 'password'> & { isActive?: boolean }): Promise<Account>;
  audit(actor: Actor, action: AuditAction, targetId: string): Promise<void>;
}
export interface AdministrationStore {
  list(roles: string[] | null, query: AccountPageQuery, includeActorId?: string): Promise<Page<Account>>;
  get(id: string): Promise<Account | null>;
  summary(roles?: string[] | null, activeOnly?: boolean, includeActorId?: string): Promise<{ totalUsers: number; activeUsers: number; inactiveUsers: number; roleCounts: Record<string, number> }>;
  audits(query: AuditPageQuery, allowedActorRoles?: string[] | null): Promise<Page<AuditRecord>>;
  recordAudit(actor: Actor, record: Omit<AuditRecord, 'id' | 'userId' | 'actor' | 'timestamp'>): Promise<void>;
  transaction<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T>;
}
const managedRoles = (role: string) => role === 'Super Admin' ? ['Admin', 'Manager', 'Inventory Staff'] : role === 'Admin' ? ['Manager', 'Inventory Staff'] : [];
function canRead(actor: Actor, user: Account) { return actor.id === user.id || actor.role === 'Super Admin' || managedRoles(actor.role).includes(user.role); }
function assertWrite(actor: Actor, user: Account) {
  if (actor.id === user.id || !managedRoles(actor.role).includes(user.role)) throw forbidden();
}
const missing = () => new AdministrationError(404, 'NOT_FOUND', 'Account not found');
export function createAdministration(store: AdministrationStore) {
  return {
    async list(actor: Actor, query: AccountPageQuery) {
      if (actor.role === 'Admin' && query.role === 'Super Admin') throw forbidden();
      const result = await store.list(actor.role === 'Super Admin' ? null : managedRoles(actor.role), query, actor.role === 'Admin' ? actor.id : undefined);
      return actor.role === 'Admin' && actor.name
        ? { ...result, items: result.items.map(item => item.id === actor.id ? { ...item, name: actor.name!.trim() } : item) }
        : result;
    },
    async get(actor: Actor, id: string) {
      const user = await store.get(id);
      if (!user || !canRead(actor, user)) throw missing();
      return user;
    },
    summary: (actor?: Actor) => store.summary(actor?.role === 'Admin' ? managedRoles(actor.role) : null, actor?.role === 'Admin', actor?.role === 'Admin' ? actor.id : undefined),
    audits: (actor: Actor, query: AuditPageQuery) => {
      if (actor.role === 'Admin' && query.actorRole === 'Super Admin') throw forbidden();
      return store.audits(query, actor.role === 'Admin' ? ['Admin', 'Manager', 'Inventory Staff'] : null);
    },
    async exportAudits(actor: Actor, query: AuditPageQuery) {
      if (actor.role === 'Admin' && query.actorRole === 'Super Admin') throw forbidden();
      try {
        const records: AuditRecord[] = [];
        const pageSize = 100;
        let page = 1;
        let total = 0;
        do {
          const result = await store.audits({ ...query, page, pageSize }, actor.role === 'Admin' ? ['Admin', 'Manager', 'Inventory Staff'] : null);
          total = result.total;
          records.push(...result.items);
          page += 1;
        } while (records.length < Math.min(total, 5000));
        if (total > 5000) throw new AdministrationError(413, 'EXPORT_TOO_LARGE', 'Narrow the filters to export at most 5,000 audit records');
        const safe = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
        const quote = (value: unknown) => `"${safe(String(value ?? '')).replace(/"/g, '""')}"`;
        const lines = [['Date & Time', 'User', 'Role', 'Action', 'Module', 'Target', 'Status', 'Details'], ...records.map(record => [record.timestamp, record.actor.name, record.actor.role, record.action, record.module ?? '', record.targetName ?? record.targetType, record.status ?? 'Success', record.details ?? ''])];
        const csv = `\uFEFF${lines.map(row => row.map(quote).join(',')).join('\r\n')}`;
        await store.recordAudit(actor, { action: 'EXPORT', targetType: 'Audit Records', targetName: 'Audit records CSV', module: 'Security & Activity', status: 'Success', details: `CSV export; ${records.length} records` });
        return csv;
      } catch (error) {
        try {
          await store.recordAudit(actor, { action: 'EXPORT', targetType: 'Audit Records', targetName: 'Audit records CSV', module: 'Security & Activity', status: 'Failed', details: 'CSV export failed before a file was prepared' });
        } catch {
          // Preserve the original export failure if its audit write also cannot be stored.
        }
        throw error;
      }
    },
    async create(actor: Actor, input: AccountInput) {
      if (!managedRoles(actor.role).includes(input.role!)) throw forbidden();
      const { password, ...fields } = input;
      const passwordHash = await hashPassword(password!);
      return store.transaction(async tx => {
        const user = await tx.create({ ...fields, passwordHash });
        await tx.audit(actor, 'CREATE', user.id);
        return user;
      });
    },
    async update(actor: Actor, id: string, input: AccountInput) {
      return store.transaction(async tx => {
        const user = await tx.get(id);
        if (!user) throw missing();
        assertWrite(actor, user);
        if (input.role && !managedRoles(actor.role).includes(input.role)) throw forbidden();
        // Unchanged email/role fields must not revoke sessions during a name-only edit.
        const changes = Object.fromEntries(Object.entries(input).filter(([key, value]) => user[key as keyof Account] !== value)) as AccountInput;
        if (!Object.keys(changes).length) return user;
        const result = await tx.update(id, changes);
        await tx.audit(actor, 'UPDATE', id);
        return result;
      });
    },
    async setActive(actor: Actor, id: string, active: boolean) {
      return store.transaction(async tx => {
        const user = await tx.get(id);
        if (!user) throw missing();
        assertWrite(actor, user);
        // Repeating a lifecycle request is a no-op, not a second administrative event.
        if (user.isActive === active) return user;
        const result = await tx.update(id, { isActive: active });
        await tx.audit(actor, active ? 'REACTIVATE' : 'DEACTIVATE', id);
        return result;
      });
    },
  };
}
export type AdministrationService = ReturnType<typeof createAdministration>;
