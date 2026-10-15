import { businessDateInputValue, businessWeekRange, shiftBusinessDate } from '../../utils/business-day';
import { isValidDateOnlyInput } from '../../utils/date-time';

export function earliestActivityDate(records: readonly { operationalDate: string }[]): string | null {
  let earliest: string | null = null;
  for (const record of records) {
    const day = record.operationalDate.slice(0, 10);
    if (!isValidDateOnlyInput(day)) throw new Error('Invalid activity date in record list');
    if (earliest === null || day < earliest) earliest = day;
  }
  return earliest;
}

export type CustomRangeState = 'incomplete' | 'invalid-date' | 'before-earliest' | 'future' | 'reversed' | 'valid';

export function customRangeState(from: string, to: string, earliest: string | null = null, today: string = businessDateInputValue()): CustomRangeState {
  if (from && !isValidDateOnlyInput(from) || to && !isValidDateOnlyInput(to)) return 'invalid-date';
  if (from && earliest && from < earliest) return 'before-earliest';
  if (from > today || to > today) return 'future';
  if (!from || !to) return 'incomplete';
  return from > to ? 'reversed' : 'valid';
}

// Which field an invalid selection is attributed to, so assistive technology
// announces only the input that actually conflicts with a boundary.
export function customRangeFieldInvalid(state: CustomRangeState, field: 'from' | 'to', from: string, to: string, today: string = businessDateInputValue()): boolean {
  if (state === 'valid' || state === 'incomplete') return false;
  if (state === 'invalid-date') return field === 'from' ? Boolean(from) && !isValidDateOnlyInput(from) : Boolean(to) && !isValidDateOnlyInput(to);
  if (state === 'before-earliest') return field === 'from';
  if (state === 'future') return field === 'from' ? from > today : to > today;
  return true;
}

export function activityDateMatches(value: string, range: string, from: string, to: string, reference: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return false;
  const day = value.slice(0, 10);
  if (range === 'Custom range') return day >= from && day <= to;
  const today = businessDateInputValue(reference);
  if (range === 'Today') return day === today;
  if (range === '7 days') { const week = businessWeekRange(reference); return day >= week.from && day <= week.to; }
  if (range === '30 days') return day >= shiftBusinessDate(today, -29) && day <= today;
  return true;
}
