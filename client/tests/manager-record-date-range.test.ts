import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activityDateMatches, customRangeFieldInvalid, customRangeState, earliestActivityDate } from '../src/components/application/manager-record-date-range';

const page = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');

test('custom activity dates are complete, ordered, inclusive, and stable across month boundaries', () => {
  assert.equal(customRangeState('', ''), 'incomplete');
  assert.equal(customRangeState('2026-10-08', ''), 'incomplete');
  assert.equal(customRangeState('2026-10-09', '2026-10-08'), 'reversed');
  assert.equal(customRangeState('2026-10-08', '2026-10-08'), 'valid');
  assert.equal(activityDateMatches('2026-10-08T00:00:00.000Z', 'Custom range', '2026-10-08', '2026-10-08'), true);
  assert.equal(activityDateMatches('2026-10-09T00:00:00.000Z', 'Custom range', '2026-10-08', '2026-10-08'), false);
  assert.equal(activityDateMatches('2026-09-30T00:00:00.000Z', 'Custom range', '2026-09-30', '2026-10-04'), true);
  assert.equal(activityDateMatches('2026-10-04T00:00:00.000Z', 'Custom range', '2026-09-30', '2026-10-04'), true);
  assert.equal(activityDateMatches('2026-09-29T00:00:00.000Z', 'Custom range', '2026-09-30', '2026-10-04'), false);
  assert.equal(activityDateMatches('2026-10-08T00:00:00.000Z', 'Custom range', '2026-10-09', '2026-10-08'), false);
});

test('picker boundaries come from every authorized Activity Date and Philippine today', () => {
  const today = '2026-10-12';
  assert.equal(earliestActivityDate([]), null);
  assert.equal(earliestActivityDate([{ operationalDate: '2026-10-10T00:00:00.000Z' }, { operationalDate: '2026-09-30T00:00:00.000Z' }]), '2026-09-30');
  assert.equal(customRangeState('2026-09-29', '2026-10-01', '2026-09-30', today), 'before-earliest');
  assert.equal(customRangeState('2026-09-30', '2026-09-30', '2026-09-30', today), 'valid');
  assert.equal(customRangeState('2026-10-12', '2026-10-12', '2026-09-30', today), 'valid');
  assert.equal(customRangeState('2026-10-13', '2026-10-13', '2026-09-30', today), 'future');
  assert.equal(customRangeState('2026-09-30', '2026-10-13', '2026-09-30', today), 'future');
  assert.equal(customRangeState('2026-10-05', '2026-10-04', '2026-09-30', today), 'reversed');
  assert.equal(customRangeState('2026-10-01', '', '2026-09-30', today), 'incomplete');
  assert.equal(customRangeState('2026-10-01', '2026-10-02', null, today), 'valid');
  assert.equal(customRangeState('2026-02-30', '2026-10-02', null, today), 'invalid-date');
  assert.throws(() => earliestActivityDate([{ operationalDate: 'broken' }]), /Invalid activity date/);
});

test('an invalid selection is attributed to the field that conflicts with a boundary', () => {
  const today = '2026-10-12';
  const earliest = '2026-09-30';
  // Nothing is flagged while the range is merely unfinished or already valid.
  assert.equal(customRangeFieldInvalid('incomplete', 'from', '2026-10-01', '', today), false);
  assert.equal(customRangeFieldInvalid('incomplete', 'to', '2026-10-01', '', today), false);
  assert.equal(customRangeFieldInvalid('valid', 'from', '2026-10-01', '2026-10-02', today), false);
  // A date before the earliest activity date belongs to From alone.
  assert.equal(customRangeFieldInvalid('before-earliest', 'from', '2026-09-29', '2026-10-01', today), true);
  assert.equal(customRangeFieldInvalid('before-earliest', 'to', '2026-09-29', '2026-10-01', today), false);
  // Only the future-dated end is flagged when the other end is still within today.
  assert.equal(customRangeFieldInvalid('future', 'from', '2026-10-01', '2026-10-13', today), false);
  assert.equal(customRangeFieldInvalid('future', 'to', '2026-10-01', '2026-10-13', today), true);
  assert.equal(customRangeFieldInvalid('future', 'from', '2026-10-13', '2026-10-01', today), true);
  // A reversed range is reported on both fields.
  assert.equal(customRangeFieldInvalid('reversed', 'from', '2026-10-05', '2026-10-04', today), true);
  assert.equal(customRangeFieldInvalid('reversed', 'to', '2026-10-05', '2026-10-04', today), true);
  // Only the malformed field is flagged when the other one is well formed.
  assert.equal(customRangeFieldInvalid('invalid-date', 'from', '2026-02-30', '2026-10-02', today), true);
  assert.equal(customRangeFieldInvalid('invalid-date', 'to', '2026-02-30', '2026-10-02', today), false);
  assert.equal(customRangeFieldInvalid('invalid-date', 'from', '', '2026-10-02', today), false);
  assert.equal(customRangeFieldInvalid('invalid-date', 'to', '2026-10-01', '2026-02-30', today), true);
  // A From later than the earliest record, and a To past the latest record, stay
  // valid: days without activity are legitimate search periods.
  assert.equal(customRangeState('2026-10-01', '2026-10-11', earliest, today), 'valid');
});

test('presets use Philippine dates and the records filter stays separate from analytics', () => {
  const philippineMidnight = new Date('2026-10-11T16:00:00.000Z');
  assert.equal(activityDateMatches('2026-10-12T00:00:00.000Z', 'Today', '', '', philippineMidnight), true);
  assert.equal(activityDateMatches('2026-10-11T00:00:00.000Z', 'Today', '', '', philippineMidnight), false);
  assert.equal(activityDateMatches('2026-10-12T00:00:00.000Z', '7 days', '', '', philippineMidnight), true);
  assert.equal(activityDateMatches('2026-10-05T00:00:00.000Z', '7 days', '', '', philippineMidnight), false);
  assert.match(page, /activityDateMatches\(record\.operationalDate, range, from, to\)/);
  // Each analytics card owns its period; the records toolbar keeps a third, separate one.
  assert.match(page, /const \[usagePeriod, setUsagePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[wastePeriod, setWastePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[range, setRange\] = useState\('All dates'\)/);
  assert.match(page, /title=\{failed \? 'Data unavailable'.*rangeInvalid \? 'Invalid date range' : rangeIncomplete \? 'Complete date range'/);
  assert.match(page, /min=\{bounded \? earliest \?\? undefined : undefined\} max=\{to && to <= today \? to : today\} aria-invalid=\{rangeFieldInvalid\('from'\)\}/);
  assert.match(page, /min=\{from \|\| undefined\} max=\{today\} aria-invalid=\{rangeFieldInvalid\('to'\)\}/);
  assert.match(page, /const bounded = records !== null;/);
  assert.doesNotMatch(page, /Choose both dates to filter records\./);
  // The inputs must not be defined as a nested component: a fresh identity each
  // render would remount them and drop focus or close an open picker.
  assert.doesNotMatch(page, /<CustomRangeFields\s*\/>/);
  assert.match(page, /formatDate\(record\.operationalDate\)/);
  assert.match(page, /\['Activity Date','Ingredient'/);
  // The redundant timestamp column was removed from the Manager table only. The
  // recorded timestamp is still mapped on the row model and carried by the API, so
  // traceability is preserved; Activity Date is the single visible date column.
  assert.doesNotMatch(page, /'Recorded At'/);
  assert.doesNotMatch(page, /formatDateTime\(record\.createdAt\)/);
  assert.match(page, /createdAt: item\.createdAt/);
  assert.match(page, /<td colSpan=\{7\} className="sl-empty-cell">/);
});
