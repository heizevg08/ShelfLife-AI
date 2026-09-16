import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import type { AccountInput, AuditPageQuery, PageQuery } from '../validators/administration';
import { hashPassword } from './password';

export interface Account {
  id: string; firstName: string; lastName: string; name: string; email: string;
  role: string; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface Actor { id: string; role: string }
export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'REACTIVATE';
export interface AuditRecord { id: string; userId: string; actor: { id: string; name: string; role: string }; action: AuditAction; targetType: string; targetId: string; timestamp: string }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface AccountTransaction {
  get(id: string): Promise<Account | null>;
  create(input: Omit<AccountInput, 'password'> & { passwordHash: string }): Promise<Account>;
  update(id: string, input: Omit<AccountInput, 'password'> & { isActive?: boolean }): Promise<Account>;
  audit(actorId: string, action: AuditAction, targetId: string): Promise<void>;
}
export interface AdministrationStore {
  list(roles: string[] | null, query: PageQuery): Promise<Page<Account>>;
  get(id: string): Promise<Account | null>;
  summary(roles?: string[] | null): Promise<{ totalUsers: number; activeUsers: number; inactiveUsers: number }>;
  audits(query: AuditPageQuery): Promise<Page<AuditRecord>>;
  transaction<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T>;
}
const managedRoles = (role: string) => role === 'Super Admin' ? ['Admin', 'Manager', 'Inventory Staff'] : role === 'Admin' ? ['Manager', 'Inventory Staff'] : [];
function canRead(actor: Actor, user: Account) { return actor.id !== user.id && managedRoles(actor.role).includes(user.role); }
function assertWrite(actor: Actor, user: Account) {
  if (actor.id === user.id || !managedRoles(actor.role).includes(user.role)) throw forbidden();
}
const missing = () => new AdministrationError(404, 'NOT_FOUND', 'Account not found');
export function createAdministration(store: AdministrationStore) {
  return {
    list: (actor: Actor, query: PageQuery) => store.list(managedRoles(actor.role), query),
    async get(actor: Actor, id: string) {
      const user = await store.get(id);
      if (!user || !canRead(actor, user)) throw missing();
      return user;
    },
    summary: (actor?: Actor) => store.summary(actor?.role === 'Admin' ? managedRoles(actor.role) : null),
    audits: (query: PageQuery) => store.audits(query),
    async create(actor: Actor, input: AccountInput) {
      if (!managedRoles(actor.role).includes(input.role!)) throw forbidden();
      const { password, ...fields } = input;
      const passwordHash = await hashPassword(password!);
      return store.transaction(async tx => {
        const user = await tx.create({ ...fields, passwordHash });
        await tx.audit(actor.id, 'CREATE', user.id);
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
        await tx.audit(actor.id, 'UPDATE', id);
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
        await tx.audit(actor.id, active ? 'REACTIVATE' : 'DEACTIVATE', id);
        return result;
      });
    },
  };
}
export type AdministrationService = ReturnType<typeof createAdministration>;
