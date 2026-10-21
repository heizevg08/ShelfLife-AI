/** The reporting timezone shared with the server's business-day helper. */
export const BUSINESS_TIME_ZONE = 'Asia/Manila';

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * Express an instant as a Philippine calendar date for date inputs and API filters.
 * @param reference - Instant to convert; defaults to now.
 * @returns Date in `YYYY-MM-DD` form.
 */
export function businessDateInputValue(reference: Date = new Date()) {
  const parts = businessDateFormatter.formatToParts(reference);
  const read = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

/**
 * Shift a calendar date in UTC so the browser timezone cannot move a range edge.
 * @param value - Date in `YYYY-MM-DD` form.
 * @param deltaDays - Whole calendar days to add or subtract.
 * @returns Shifted date in `YYYY-MM-DD` form.
 * @throws RangeError when the date does not match the expected form.
 */
export function shiftBusinessDate(value: string, deltaDays: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Build an inclusive range of Philippine calendar days ending on the reference day.
 * @param days - Number of whole days, including the reference day.
 * @param reference - Instant whose Philippine date ends the range.
 * @returns Inclusive `from` and `to` dates for API filters.
 * @throws RangeError when `days` is not a positive integer.
 */
export function businessDayRange(days: number, reference: Date = new Date()): { from: string; to: string } {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('A business day range needs at least one whole day.');
  const to = businessDateInputValue(reference);
  return { from: shiftBusinessDate(to, -(days - 1)), to };
}

/**
 * Index a calendar date from Monday (0) through Sunday (6), independent of locale.
 * @param value - Date in `YYYY-MM-DD` form.
 * @returns Monday-based weekday index.
 * @throws RangeError when the date does not match the expected form.
 */
export function businessWeekdayIndex(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return (weekday + 6) % 7;
}

/**
 * Keep Manager charts on a fixed Monday-to-Sunday Philippine business week.
 * @param reference - Instant within the target week.
 * @returns Inclusive `from` and `to` calendar dates.
 */
export function businessWeekRange(reference: Date = new Date()): { from: string; to: string } {
  const today = businessDateInputValue(reference);
  const from = shiftBusinessDate(today, -businessWeekdayIndex(today));
  return { from, to: shiftBusinessDate(from, 6) };
}

/**
 * Bound a monthly report to its Philippine calendar month, not a rolling 30 days.
 * @param reference - Instant within the target month.
 * @returns Inclusive first and last calendar dates of that month.
 */
export function businessMonthRange(reference: Date = new Date()): { from: string; to: string } {
  const from = `${businessDateInputValue(reference).slice(0, 7)}-01`;
  const year = Number(from.slice(0, 4));
  const month = Number(from.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${from.slice(0, 8)}${pad(lastDay)}` };
}
