import { invalid } from './administration';
import { AdministrationError } from '../middleware/administration.middleware';

export function bodyFields(body: unknown, fields: readonly string[]) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (!fields.includes(key)) invalid(key, 'Field is not permitted');
  return input;
}
export function expectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) invalid('expectedVersion');
  return value;
}
export function archiveInput(body: unknown) { return expectedVersion(bodyFields(body, ['expectedVersion']).expectedVersion); }
export const versionConflict = () => new AdministrationError(409, 'VERSION_CONFLICT', 'This record changed. Reload it before saving.');
export function versionFilter(version: number) {
  return version === 0 ? { $or: [{ version: 0 }, { version: { $exists: false } }] } : { version };
}
export function decimal(value: unknown, scale: number, field: string): string {
  // Bound integer digits so every accepted fixed-point value fits Decimal128 exactly.
  if (typeof value !== 'string' || !new RegExp(`^(0|[1-9]\\d{0,17})(\\.\\d{1,${scale}})?$`).test(value)) invalid(field, `Use a nonnegative decimal string with at most ${scale} decimal places and 18 integer digits`);
  const [whole, fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(scale, '0')}`;
}
export function decimalUnits(value: string): bigint { return BigInt(value.replace('.', '')); }
export function storedDecimal(value: { toString(): string }, scale: number): string { return decimal(value.toString(), scale, 'decimal'); }
export function calendarDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) invalid(field, 'Use a valid YYYY-MM-DD calendar date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid(field);
  return value;
}
export function inventoryPagination(query: Record<string, unknown>) {
  const integer = (key: string, fallback: number, max: number) => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) invalid(key);
    return Number(value);
  };
  if (query.includeArchived !== undefined && !['true', 'false'].includes(query.includeArchived as string)) invalid('includeArchived');
  return { page: integer('page', 1, 1000000), limit: integer('limit', 25, 100), includeArchived: query.includeArchived === 'true' };
}
