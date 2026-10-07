import { AdministrationError } from '../middleware/administration.middleware';
import { ROLES } from '../models/user';
import { normalizeEmail, validPassword } from './auth';
import { personNameInput } from './text';

export function invalid(field: string, message = 'Invalid value'): never {
  throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field, message }]);
}
export function objectId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) invalid('id');
  return value;
}
export function emptyQuery(query: Record<string, unknown>) {
  for (const key of Object.keys(query)) invalid(key, 'No query parameters are accepted');
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
export type AccountListQuery = PageQuery & { search?: string; role?: typeof ROLES[number]; isActive?: boolean };
export function accountPagination(query: Record<string, unknown>): AccountListQuery {
  const pageKeys = ['page', 'pageSize', 'sortBy', 'sortOrder'];
  for (const key of Object.keys(query)) if (![...pageKeys, 'search', 'role', 'status'].includes(key)) invalid(key);
  const page = pagination(Object.fromEntries(pageKeys.filter(key => query[key] !== undefined).map(key => [key, query[key]])), ['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'role', 'isActive'], 'createdAt');
  const result: AccountListQuery = { ...page };
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 64) invalid('search', 'Use at most 64 characters');
    const search = query.search.trim();
    if (search) result.search = search;
  }
  if (query.role !== undefined) {
    if (typeof query.role !== 'string' || !ROLES.includes(query.role as typeof ROLES[number])) invalid('role');
    result.role = query.role as typeof ROLES[number];
  }
  if (query.status !== undefined) {
    if (query.status !== 'active' && query.status !== 'inactive') invalid('status');
    result.isActive = query.status === 'active';
  }
  return result;
}
const auditActions = ['CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'REACTIVATE', 'CHANGE_REQUEST_SUBMITTED', 'CHANGE_REQUEST_APPROVED', 'CHANGE_REQUEST_REJECTED'] as const;
export type AuditActionFilter = typeof auditActions[number];
export type AuditPageQuery = PageQuery & { actorRole?: typeof ROLES[number]; action?: AuditActionFilter; from?: Date; to?: Date };
function auditDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z)?$/.test(value)) invalid(field, 'Use YYYY-MM-DD or an ISO UTC timestamp');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) invalid(field, 'Use a valid calendar date');
  return date;
}
export function auditPagination(query: Record<string, unknown>): AuditPageQuery {
  const pageKeys = ['page', 'pageSize', 'sortBy', 'sortOrder'];
  for (const key of Object.keys(query)) if (![...pageKeys, 'actorRole', 'action', 'from', 'to'].includes(key)) invalid(key);
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
    result.from = auditDate(query.from, 'from');
  }
  if (query.to !== undefined) {
    result.to = auditDate(query.to, 'to');
  }
  if (result.from && result.to && result.from > result.to) invalid('to', 'End date must be on or after start date');
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
    result[field] = personNameInput(input[field], field);
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
