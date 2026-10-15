import { invalid } from './administration';

export function calendarDate(field: string, value: unknown) {
  if (typeof value !== 'string') invalid(field);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) invalid(field);
  const [year, month, day] = match.slice(1).map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) invalid(field);
  return result;
}
