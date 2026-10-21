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

/**
 * Format the viewer's local calendar date for a native date input.
 * @param value - Date to display; defaults to now.
 * @returns Local date in `YYYY-MM-DD` form.
 */
export function localDateInputValue(value: Date = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * Reject impossible dates that match the date-input shape but roll into another month.
 * @param value - Candidate `YYYY-MM-DD` date.
 * @returns Whether the date exists on the calendar.
 */
export function isValidDateOnlyInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * Display a date-only value without shifting it across browser timezones.
 * @param value - Calendar date or timestamp.
 * @returns Short display date.
 */
export function formatDate(value: DateValue) {
  return dateFormatter.format(dateOnlyValue(value));
}

/**
 * Pair the shared display date with the viewer's formatted time.
 * @param value - Calendar date or timestamp.
 * @returns Date and time for display.
 */
export function formatDateTime(value: DateValue) {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/**
 * Show the establishment's date and time in the Philippine timezone.
 * @param value - Calendar date or timestamp.
 * @returns Weekday, date, and time for the top bar.
 */
export function formatTopbarDateTime(value: DateValue) {
  // A date-only value denotes a Philippine calendar date; timestamps remain instants.
  const base = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+08:00`)
    : new Date(value);
  return `${topbarWeekdayFormatter.format(base)}, ${topbarDateFormatter.format(base)}, ${topbarTimeFormatter.format(base)}`;
}

/**
 * Format the viewer's local time for a timestamp.
 * @param value - Calendar date or timestamp.
 * @returns Short 12-hour time.
 */
export function formatTime(value: DateValue) {
  return timeFormatter.format(new Date(value));
}
