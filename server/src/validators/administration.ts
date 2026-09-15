import { AdministrationError } from '../middleware/administration.middleware';
import { ROLES } from '../models/user';
import { normalizeEmail, validPassword } from './auth';

export function invalid(field: string, message = 'Invalid value'): never {
  throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field, message }]);
}
export function objectId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) invalid('id');
  return value;
}
export function pagination(query: Record<string, unknown>, sorts: string[], fallback: string) {
  for (const key of Object.keys(query)) if (!['page', 'pageSize', 'sortBy', 'sortOrder'].includes(key)) invalid(key);
  const integer = (key: string, defaultValue: number, max: number) => {
    const value = query[key];
    if (value === undefined) return defaultValue;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) invalid(key);
    return Number(value);
  };
  const page = integer('page', 1, 1000000), pageSize = integer('pageSize', 25, 100);
  const sortBy = query.sortBy ?? fallback, sortOrder = query.sortOrder ?? 'desc';
  if (typeof sortBy !== 'string' || !sorts.includes(sortBy)) invalid('sortBy');
  if (sortOrder !== 'asc' && sortOrder !== 'desc') invalid('sortOrder');
  return { page, pageSize, sortBy, sortOrder: sortOrder as 'asc' | 'desc' };
}
export type PageQuery = ReturnType<typeof pagination>;
const auditActions = ['CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE'] as const;
export type AuditActionFilter = typeof auditActions[number];
export type AuditPageQuery = PageQuery & { actorRole?: typeof ROLES[number]; action?: AuditActionFilter; from?: Date };
export function auditPagination(query: Record<string, unknown>): AuditPageQuery {
  const pageKeys = ['page', 'pageSize', 'sortBy', 'sortOrder'];
  for (const key of Object.keys(query)) if (![...pageKeys, 'actorRole', 'action', 'from'].includes(key)) invalid(key);
  const page = pagination(Object.fromEntries(pageKeys.filter(key => query[key] !== undefined).map(key => [key, query[key]])), ['timestamp', 'action', 'targetType'], 'timestamp');
  const result: AuditPageQuery = { ...page };
  if (query.actorRole !== undefined) {
    if (typeof query.actorRole !== 'string' || !ROLES.includes(query.actorRole as typeof ROLES[number])) invalid('actorRole');
    result.actorRole = query.actorRole as typeof ROLES[number];
  }
  if (query.action !== undefined) {
    if (typeof query.action !== 'string' || !auditActions.includes(query.action as AuditActionFilter)) invalid('action');
    result.action = query.action as AuditActionFilter;
  }
  if (query.from !== undefined) {
    if (typeof query.from !== 'string' || !Number.isFinite(Date.parse(query.from))) invalid('from');
    result.from = new Date(query.from);
  }
  return result;
}
export type AccountInput = { firstName?: string; lastName?: string; email?: string; role?: typeof ROLES[number]; password?: string };
export function accountInput(body: unknown, create: boolean): AccountInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>, result: AccountInput = {};
  const fields = ['firstName', 'lastName', 'email', 'role', ...(create ? ['password'] : [])];
  for (const key of Object.keys(input)) if (!fields.includes(key)) invalid(key, 'Field is not permitted');
  if (!Object.keys(input).length) invalid('body', 'Provide at least one permitted field');
  for (const field of ['firstName', 'lastName'] as const) {
    if (!create && input[field] === undefined) continue;
    const value = input[field];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 25) invalid(field, 'Enter 1–25 characters');
    result[field] = value.trim();
  }
  if (create || input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!email) invalid('email', 'Enter a valid shelflife.com email');
    result.email = email;
  }
  if (create || input.role !== undefined) {
    if (typeof input.role !== 'string' || !ROLES.includes(input.role as typeof ROLES[number])) invalid('role');
    result.role = input.role as typeof ROLES[number];
  }
  if (create) {
    if (!validPassword(input.password) || input.password.length < 12) invalid('password', 'Use at least 12 characters');
    result.password = input.password;
  }
  return result;
}
