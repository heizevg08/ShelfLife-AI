import { BUSINESS_TIME_ZONE } from './business-day';

type DateValue = string | Date;

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const topbarDateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const topbarWeekdayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIME_ZONE, weekday: 'long' });
const topbarTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true });

function dateOnlyValue(value: DateValue) {
  if (typeof value !== 'string') return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export function localDateInputValue(value: Date = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function isValidDateOnlyInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatDate(value: DateValue) {
  return dateFormatter.format(dateOnlyValue(value));
}

export function formatDateTime(value: DateValue) {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatTopbarDateTime(value: DateValue) {
  // A date-only value denotes a Philippine calendar date; timestamps remain instants.
  const base = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+08:00`)
    : new Date(value);
  return `${topbarWeekdayFormatter.format(base)}, ${topbarDateFormatter.format(base)}, ${topbarTimeFormatter.format(base)}`;
}

export function formatTime(value: DateValue) {
  return timeFormatter.format(new Date(value));
}
