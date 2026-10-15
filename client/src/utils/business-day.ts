// ShelfLifeAI reports on Philippine operations, so a business "day" means a
// Philippine calendar day even when the viewer's browser runs in another
// timezone. This mirrors the server helper in `server/src/utils/business-day.ts`
// so the UI and the API agree on which dates a filter covers. Asia/Manila is a
// fixed +08:00 zone without daylight saving, so a calendar date always maps to
// one instant range and no extra dependency is needed beyond Intl.
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

// The business calendar date of an instant, as the `YYYY-MM-DD` value a date
// input or a `from`/`to` API parameter expects.
export function businessDateInputValue(reference: Date = new Date()) {
  const parts = businessDateFormatter.formatToParts(reference);
  const read = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

// Calendar arithmetic on a `YYYY-MM-DD` value. Days are counted on the calendar
// itself, so the result never depends on the host timezone and an expiry or a
// range edge cannot slip by a day near a daylight-saving transition.
export function shiftBusinessDate(value: string, deltaDays: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// The `from`/`to` pair for `days` whole Philippine calendar dates that end with
// the reference day. Both ends are inclusive, so 7 days means today plus the
// previous six Philippine dates rather than a rolling 168-hour window. Manager
// analytics no longer use this for their 7-day preset: that preset is the current
// Monday-to-Sunday business week, via `businessWeekRange`.
export function businessDayRange(days: number, reference: Date = new Date()): { from: string; to: string } {
  if (!Number.isInteger(days) || days < 1) throw new RangeError('A business day range needs at least one whole day.');
  const to = businessDateInputValue(reference);
  return { from: shiftBusinessDate(to, -(days - 1)), to };
}

// The weekday of a calendar date, with Monday as 0 and Sunday as 6. The date is
// read in UTC because it is already a business calendar day, so the answer never
// depends on the host timezone.
export function businessWeekdayIndex(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Not a calendar date: ${value}`);
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return (weekday + 6) % 7;
}

// The Philippine business week that contains the reference day: Monday 00:00
// through Sunday. Manager analytics use a fixed week so a weekday keeps the same
// position on the chart every visit, unlike a trailing seven-day window that
// rotates the sequence each day. Both ends are inclusive calendar dates.
export function businessWeekRange(reference: Date = new Date()): { from: string; to: string } {
  const today = businessDateInputValue(reference);
  const from = shiftBusinessDate(today, -businessWeekdayIndex(today));
  return { from, to: shiftBusinessDate(from, 6) };
}

// The Philippine business month that contains the reference day: the first
// through the last calendar date of that month, both inclusive. The last date is
// found on the calendar itself (`day 0` of the following month) so February and
// every other month length are handled without a lookup table. A monthly report
// therefore counts Philippine calendar dates rather than a trailing thirty-day
// window that would straddle two months.
export function businessMonthRange(reference: Date = new Date()): { from: string; to: string } {
  const from = `${businessDateInputValue(reference).slice(0, 7)}-01`;
  const year = Number(from.slice(0, 4));
  const month = Number(from.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${from.slice(0, 8)}${pad(lastDay)}` };
}
