/** Reporting timezone shared with the client, independent of the host timezone. */
export const BUSINESS_TIME_ZONE = 'Asia/Manila';

/** Year, month, and day on the Philippine business calendar. */
export type BusinessCalendarDate = { year: number; month: number; day: number };

/** Half-open time range so adjacent reports never count a boundary twice. */
export type BusinessDayBounds = { start: Date; end: Date };

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const part = parts.find(candidate => candidate.type === type);
  if (!part) throw new Error(`Missing ${type} while reading the business timezone.`);
  return Number(part.value);
}

function zonedTimestamp(instant: Date) {
  const parts = partsFormatter.formatToParts(instant);
  return {
    year: formatPart(parts, 'year'),
    month: formatPart(parts, 'month'),
    day: formatPart(parts, 'day'),
    // Some ICU builds render Philippine midnight as hour 24; normalize it so the
    // wall-clock reading always stays inside the same calendar date.
    hour: formatPart(parts, 'hour') % 24,
    minute: formatPart(parts, 'minute'),
    second: formatPart(parts, 'second'),
  };
}

function zoneOffsetMs(instant: Date) {
  const zoned = zonedTimestamp(instant);
  const asIfUTC = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  // Compare the zone's wall-clock reading (treated as UTC) against the real
  // instant to recover the offset, without trusting the host's own timezone.
  return asIfUTC - Math.floor(instant.getTime() / 1000) * 1000;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function addCalendarDays(date: BusinessCalendarDate, delta: number): BusinessCalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + delta));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function calendarDateInstant(date: BusinessCalendarDate): Date {
  const asIfUTC = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  // Start from the naive instant and subtract the zone offset. A second pass
  // keeps the result exact when an offset depends on the date being resolved.
  const firstPass = new Date(asIfUTC - zoneOffsetMs(new Date(asIfUTC)));
  return new Date(asIfUTC - zoneOffsetMs(firstPass));
}

/**
 * Read an instant on the Philippine business calendar.
 * @param reference - Instant to convert.
 * @returns Calendar year, month, and day.
 */
export function businessCalendarDate(reference: Date): BusinessCalendarDate {
  const zoned = zonedTimestamp(reference);
  return { year: zoned.year, month: zoned.month, day: zoned.day };
}

/**
 * Format an instant as a Philippine calendar date for API filters.
 * @param reference - Instant to convert.
 * @returns Date in `YYYY-MM-DD` form.
 */
export function businessDateString(reference: Date): string {
  const { year, month, day } = businessCalendarDate(reference);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Bound the Philippine business day containing an instant.
 * @param reference - Instant within the target day.
 * @returns Inclusive start and exclusive end instants.
 */
export function businessDayBounds(reference: Date): BusinessDayBounds {
  const date = businessCalendarDate(reference);
  return { start: calendarDateInstant(date), end: calendarDateInstant(addCalendarDays(date, 1)) };
}

/**
 * Bound the Philippine business day preceding an instant.
 * @param reference - Instant after the target day.
 * @returns Inclusive start and exclusive end instants.
 */
export function previousBusinessDayBounds(reference: Date): BusinessDayBounds {
  const previous = addCalendarDays(businessCalendarDate(reference), -1);
  return { start: calendarDateInstant(previous), end: calendarDateInstant(addCalendarDays(previous, 1)) };
}

/**
 * Count a Philippine calendar month rather than the host's local month.
 * @param reference - Instant within the target month.
 * @returns Inclusive start and exclusive end instants.
 */
export function businessMonthBounds(reference: Date): BusinessDayBounds {
  const { year, month } = businessCalendarDate(reference);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { start: calendarDateInstant({ year, month, day: 1 }), end: calendarDateInstant({ year: nextYear, month: nextMonth, day: 1 }) };
}

/**
 * Count whole Philippine dates instead of a rolling span of hours.
 * @param reference - Instant within the last included day.
 * @param days - Positive count of calendar days.
 * @returns Inclusive start and exclusive end instants.
 * @throws RangeError when `days` is not a positive integer.
 */
export function recentBusinessCalendarBounds(reference: Date, days: number): BusinessDayBounds {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('A recent business range needs at least one whole day.');
  const today = businessCalendarDate(reference);
  return { start: calendarDateInstant(addCalendarDays(today, -(days - 1))), end: calendarDateInstant(addCalendarDays(today, 1)) };
}

/**
 * Convert a date-only filter into Philippine day boundaries.
 * @param value - Calendar date in `YYYY-MM-DD` form.
 * @returns Inclusive start and exclusive end instants.
 * @throws RangeError when the date does not match the expected form.
 */
export function businessDayBoundsForCalendarDate(value: string): BusinessDayBounds {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const date: BusinessCalendarDate = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return { start: calendarDateInstant(date), end: calendarDateInstant(addCalendarDays(date, 1)) };
}

/**
 * Preserve the intended date of a field serialized at UTC midnight.
 * @param value - Stored date-only field.
 * @returns Calendar date in `YYYY-MM-DD` form.
 */
export function dateOnlyCalendarString(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

/**
 * Shift a calendar date without using the host timezone.
 * @param value - Date in `YYYY-MM-DD` form.
 * @param deltaDays - Whole calendar days to add or subtract.
 * @returns Shifted date in `YYYY-MM-DD` form.
 * @throws RangeError when the date does not match the expected form.
 */
export function shiftCalendarDate(value: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Include zero-activity dates while retaining the most recent dates when capped.
 * @param from - First included `YYYY-MM-DD` date.
 * @param to - Last included `YYYY-MM-DD` date.
 * @param limit - Maximum number of recent dates to return.
 * @returns Inclusive ascending calendar-date sequence.
 */
export function calendarDateSequence(from: string, to: string, limit = 400): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  for (let cursor = to; cursor >= from && dates.length < limit; cursor = shiftCalendarDate(cursor, -1)) dates.push(cursor);
  return dates.reverse();
}
