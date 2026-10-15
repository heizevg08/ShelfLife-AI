// ShelfLifeAI reports on Philippine operations, so a "day" means a Philippine
// calendar day even when the server or browser runs in another timezone.
// Asia/Manila is a fixed +08:00 zone without daylight saving, so every calendar
// date maps to exactly one UTC instant range and no timezone dependency is
// needed beyond the zone data already shipped with Intl.
export const BUSINESS_TIME_ZONE = 'Asia/Manila';

export type BusinessCalendarDate = { year: number; month: number; day: number };

// A filtering window for one or more business days: the start instant is
// included and the end instant is excluded, so adjacent windows never double
// count the boundary instant.
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

// The business calendar date of an instant, as read on a Philippine clock.
export function businessCalendarDate(reference: Date): BusinessCalendarDate {
  const zoned = zonedTimestamp(reference);
  return { year: zoned.year, month: zoned.month, day: zoned.day };
}

// The business calendar date of an instant as `YYYY-MM-DD`.
export function businessDateString(reference: Date): string {
  const { year, month, day } = businessCalendarDate(reference);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// The boundaries of the business day that contains the reference instant.
export function businessDayBounds(reference: Date): BusinessDayBounds {
  const date = businessCalendarDate(reference);
  return { start: calendarDateInstant(date), end: calendarDateInstant(addCalendarDays(date, 1)) };
}

// The boundaries of the business day immediately before the reference instant.
export function previousBusinessDayBounds(reference: Date): BusinessDayBounds {
  const previous = addCalendarDays(businessCalendarDate(reference), -1);
  return { start: calendarDateInstant(previous), end: calendarDateInstant(addCalendarDays(previous, 1)) };
}

// The boundaries of the business month that contains the reference instant, so a
// monthly total counts Philippine calendar dates rather than a host-local month.
export function businessMonthBounds(reference: Date): BusinessDayBounds {
  const { year, month } = businessCalendarDate(reference);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { start: calendarDateInstant({ year, month, day: 1 }), end: calendarDateInstant({ year: nextYear, month: nextMonth, day: 1 }) };
}

// Boundaries spanning `days` whole business days that end with the reference
// day, counted as calendar days so "last 7 days" means 7 Philippine dates
// rather than a rolling 168-hour window that drifts with the time of day.
export function recentBusinessCalendarBounds(reference: Date, days: number): BusinessDayBounds {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('A recent business range needs at least one whole day.');
  const today = businessCalendarDate(reference);
  return { start: calendarDateInstant(addCalendarDays(today, -(days - 1))), end: calendarDateInstant(addCalendarDays(today, 1)) };
}

// Boundaries for a `YYYY-MM-DD` calendar date, for filters that receive a date.
export function businessDayBoundsForCalendarDate(value: string): BusinessDayBounds {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const date: BusinessCalendarDate = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return { start: calendarDateInstant(date), end: calendarDateInstant(addCalendarDays(date, 1)) };
}

// The calendar date carried by a date-only field. Such fields are stored at UTC
// midnight for their intended date, so UTC getters return that date unchanged in
// every host timezone, while local getters would shift it near the day edge.
export function dateOnlyCalendarString(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

// Calendar arithmetic on a `YYYY-MM-DD` value. Days are counted on the calendar
// itself, so the result never depends on the host timezone.
export function shiftCalendarDate(value: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// Every calendar date from `from` to `to`, both inclusive, as `YYYY-MM-DD`. A
// daily analytics series is built over this sequence so a day with no records is
// published as a real zero instead of vanishing from the chart. When the span is
// longer than `limit`, the most recent days are kept: a chart should show current
// activity rather than truncate at an arbitrary older point.
export function calendarDateSequence(from: string, to: string, limit = 400): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  for (let cursor = to; cursor >= from && dates.length < limit; cursor = shiftCalendarDate(cursor, -1)) dates.push(cursor);
  return dates.reverse();
}
