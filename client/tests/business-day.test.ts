import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { businessDateInputValue, businessDayRange, businessMonthRange, businessWeekRange, businessWeekdayIndex, shiftBusinessDate } from '../src/utils/business-day';

// A date-only string is what a date input and a `from`/`to` API parameter carry.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

test('a business day starts at Philippine midnight, not at UTC midnight', () => {
  // 16:00 UTC is exactly 00:00 the next day in Manila (UTC+8, no DST).
  assert.equal(businessDateInputValue(new Date('2026-10-08T15:59:59.999Z')), '2026-10-08');
  assert.equal(businessDateInputValue(new Date('2026-10-08T16:00:00.000Z')), '2026-10-09');
});

test('the instant just before and at Philippine midnight straddle two business dates', () => {
  const before = new Date('2026-10-08T16:00:00.000Z').getTime() - 1;
  assert.equal(businessDateInputValue(new Date(before)), '2026-10-08');
  assert.equal(businessDateInputValue(new Date(before + 1)), '2026-10-09');
});

test('a business date is always returned as a date-only value', () => {
  assert.equal(businessDateInputValue(new Date('2026-01-05T03:30:00.000Z')), '2026-01-05');
  assert.match(businessDateInputValue(new Date('2026-06-30T22:00:00.000Z')), DATE_ONLY);
});

test('Last 7 Days covers today plus the previous six Philippine dates', () => {
  const reference = new Date('2026-10-11T04:00:00.000Z'); // 2026-10-11 12:00 Manila
  const range = businessDayRange(7, reference);
  assert.deepEqual(range, { from: '2026-10-05', to: '2026-10-11' });
  // Both ends are inclusive, so the span is exactly seven dates.
  assert.equal(7, Number(range.to.slice(-2)) - Number(range.from.slice(-2)) + 1);
});

test('Last 30 Days covers today plus the previous 29 Philippine dates', () => {
  const range = businessDayRange(30, new Date('2026-10-11T04:00:00.000Z'));
  assert.deepEqual(range, { from: '2026-09-12', to: '2026-10-11' });
});

test('a single-day range starts and ends on the same business date', () => {
  const range = businessDayRange(1, new Date('2026-10-11T04:00:00.000Z'));
  assert.deepEqual(range, { from: '2026-10-11', to: '2026-10-11' });
});

test('calendar arithmetic crosses month-end, year-end and a leap day', () => {
  assert.equal(shiftBusinessDate('2026-10-01', -6), '2026-09-25');
  assert.equal(shiftBusinessDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftBusinessDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftBusinessDate('2028-02-28', 1), '2028-02-29'); // 2028 is a leap year
  assert.equal(shiftBusinessDate('2027-02-28', 1), '2027-03-01'); // 2027 is not
});

test('a business-date range never drifts by a day at month-end', () => {
  // 2026-11-01 00:30 Manila is 2026-10-31 16:30 UTC, so a UTC calendar would
  // report the previous month while the business month has already rolled over.
  const range = businessDayRange(7, new Date('2026-10-31T16:30:00.000Z'));
  assert.deepEqual(range, { from: '2026-10-26', to: '2026-11-01' });
});

test('the business week is Monday through Sunday, whatever day is the reference', () => {
  // 2026-10-11 is a Sunday, so its business week is 2026-10-05 (Monday) to
  // 2026-10-11 (Sunday). Both ends are inclusive, so the span is exactly 7 dates.
  assert.deepEqual(businessWeekRange(new Date('2026-10-11T04:00:00.000Z')), { from: '2026-10-05', to: '2026-10-11' });
  // Any day inside the same week returns the same Monday-to-Sunday pair.
  for (const day of ['2026-10-05', '2026-10-07', '2026-10-10', '2026-10-11']) {
    assert.deepEqual(businessWeekRange(new Date(`${day}T04:00:00.000Z`)), { from: '2026-10-05', to: '2026-10-11' }, day);
  }
  // Monday is always index 0 and Sunday always 6.
  assert.equal(businessWeekdayIndex('2026-10-05'), 0);
  assert.equal(businessWeekdayIndex('2026-10-11'), 6);
  // A week spanning a month boundary keeps its Monday start and Sunday end.
  assert.deepEqual(businessWeekRange(new Date('2026-11-01T04:00:00.000Z')), { from: '2026-10-26', to: '2026-11-01' });
});

test('the business month is the first through last Philippine date of that month', () => {
  // 2026-10-12 is mid-month; its business month is the whole of October.
  assert.deepEqual(businessMonthRange(new Date('2026-10-12T04:00:00.000Z')), { from: '2026-10-01', to: '2026-10-31' });
  // Month length comes from the calendar, not a fixed 30 or 31.
  assert.deepEqual(businessMonthRange(new Date('2026-02-15T04:00:00.000Z')), { from: '2026-02-01', to: '2026-02-28' });
  // A leap February ends on the 29th.
  assert.deepEqual(businessMonthRange(new Date('2028-02-15T04:00:00.000Z')), { from: '2028-02-01', to: '2028-02-29' });
  // A 30-day month.
  assert.deepEqual(businessMonthRange(new Date('2026-04-30T04:00:00.000Z')), { from: '2026-04-01', to: '2026-04-30' });
  // December rolls to the 31st without moving into the next year.
  assert.deepEqual(businessMonthRange(new Date('2026-12-31T04:00:00.000Z')), { from: '2026-12-01', to: '2026-12-31' });
  // A monthly report is the calendar month, never a trailing 30-day window: on
  // 1 November it covers November alone and does not reach back into October.
  assert.deepEqual(businessMonthRange(new Date('2026-11-01T04:00:00.000Z')), { from: '2026-11-01', to: '2026-11-30' });
  // Every business date in the month is inside the range, and no other date is.
  const range = businessMonthRange(new Date('2026-10-12T04:00:00.000Z'));
  assert.equal(range.from, '2026-10-01');
  assert.equal(range.to, '2026-10-31');
  assert.ok('2026-10-15' >= range.from && '2026-10-15' <= range.to);
  assert.ok('2026-09-30' < range.from);
  assert.ok('2026-11-01' > range.to);
});

test('the month boundaries are Philippine dates whatever timezone the host runs in', () => {
  const moduleUrl = new URL('../src/utils/business-day.ts', import.meta.url).href;
  const clientDir = fileURLToPath(new URL('..', import.meta.url));
  const script = `
const url = ${JSON.stringify(moduleUrl)};
import(url).then((m) => {
  process.stdout.write(JSON.stringify({
    october: m.businessMonthRange(new Date('2026-10-31T16:30:00.000Z')),
    february: m.businessMonthRange(new Date('2026-02-28T16:30:00.000Z')),
  }));
});
`;
  const zones = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Asia/Manila'];
  const results = zones.map(zone => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--eval', script], {
    cwd: clientDir,
    env: { ...process.env, TZ: zone },
    encoding: 'utf8',
  })));
  for (const result of results) assert.deepEqual(result, results[0], 'every host timezone must report the same Philippine month');
  // 2026-10-31 16:30 UTC is already 1 November in Manila, so the business month has
  // rolled over even though a UTC calendar still reads October.
  assert.deepEqual(results[0].october, { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(results[0].february, { from: '2026-03-01', to: '2026-03-31' });
});

test('the same business dates result whatever timezone the host runs in', () => {
  const moduleUrl = new URL('../src/utils/business-day.ts', import.meta.url).href;
  const clientDir = fileURLToPath(new URL('..', import.meta.url));
  const script = `
const url = ${JSON.stringify(moduleUrl)};
const instants = ['2026-10-08T15:59:59.999Z','2026-10-08T16:00:00.000Z','2026-12-31T16:00:00.000Z','2026-01-01T15:59:59.000Z'];
import(url).then((m) => {
  process.stdout.write(JSON.stringify({
    dates: instants.map(value => m.businessDateInputValue(new Date(value))),
    range7: m.businessDayRange(7, new Date('2026-10-11T04:00:00.000Z')),
    range30: m.businessDayRange(30, new Date('2026-10-11T04:00:00.000Z')),
  }));
});
`;
  const zones = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Asia/Manila'];
  const results = zones.map(zone => {
    const raw = execFileSync(process.execPath, ['--import', 'tsx', '--eval', script], {
      cwd: clientDir,
      env: { ...process.env, TZ: zone },
      encoding: 'utf8',
    });
    return JSON.parse(raw);
  });
  for (const result of results) {
    assert.deepEqual(result, results[0], 'every host timezone must report the same Philippine dates');
  }
  assert.deepEqual(results[0].dates, ['2026-10-08', '2026-10-09', '2027-01-01', '2026-01-01']);
});

test('a backdated record is judged on its Philippine calendar date', () => {
  const reference = new Date('2026-10-11T04:00:00.000Z');
  const today = businessDateInputValue(reference);
  const last7 = shiftBusinessDate(today, -6);
  const last30 = shiftBusinessDate(today, -29);
  const dayOf = (iso: string) => businessDateInputValue(new Date(iso));

  const recent = dayOf('2026-10-09T02:00:00.000Z'); // inside the last 7 days
  const older = dayOf('2026-10-01T02:00:00.000Z'); // outside 7 days, inside 30
  const oldest = dayOf('2026-08-01T02:00:00.000Z'); // outside 30 days

  assert.ok(recent >= last7);
  assert.ok(older < last7 && older >= last30);
  assert.ok(oldest < last30);
});

test('every date-filtering consumer reads Philippine business dates', () => {
  const consumers = [
    'components/application/ModulePage.tsx',
    'components/application/ManagerUsageWastePage.tsx',
    'components/application/ManagerChangeRequestsPage.tsx',
    'components/application/InventoryStaffBulkModal.tsx',
    'app/(administration)/ChangeRequests.tsx',
  ];
  for (const relative of consumers) {
    const source = readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');
    assert.match(source, /utils\/business-day/, `${relative} must use the shared business-day helper`);
    assert.doesNotMatch(source, /localDateInputValue/, `${relative} must not build dates from browser-local time`);
  }
});

test('rolling-hour reporting windows are gone from the date-filtered modules', () => {
  const sources = [
    'components/application/ModulePage.tsx',
    'components/application/ManagerUsageWastePage.tsx',
    'components/application/ManagerChangeRequestsPage.tsx',
    'app/(administration)/ChangeRequests.tsx',
  ].map(relative => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8'));
  for (const source of sources) {
    assert.doesNotMatch(source, /\d{4}\s*\*\s*86400000|Date\.now\(\)\s*-\s*days\s*\*\s*86400000/);
  }
});

test('the approved date-range labels and reset behaviour are unchanged', () => {
  const changeRequests = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  assert.match(changeRequests, /const DATE_RANGES=\['All dates','Today','Last 7 Days','Last 30 Days','Custom range'\] as const;/);

  const modulePage = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  assert.match(modulePage, /const STOCK_IN_DATE_RANGES = \['All dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom range'\] as const;/);

  const usageWaste = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
  assert.match(usageWaste, /setRange\('All dates'\)/);
  // The four labels and their order are unchanged; only their markup form moved to the
  // shared FilterSelect options array during the system-wide selector standardization.
  assert.match(usageWaste, /options=\{\[\{value:'All dates',label:'All dates'\},\{value:'Today',label:'Today'\},\{value:'7 days',label:'7 days'\},\{value:'30 days',label:'30 days'\},\{value:'Custom range',label:'Custom range'\}\]\}/);
});

test('filters still send date-only values on the existing from/to parameters', () => {
  for (const service of ['usage-records', 'waste-records', 'inventory-batches']) {
    const source = readFileSync(new URL(`../src/services/${service}.ts`, import.meta.url), 'utf8');
    assert.match(source, /params\.set\('from', query\.from\)/, `${service} keeps its from parameter`);
    assert.match(source, /params\.set\('to', query\.to\)/, `${service} keeps its to parameter`);
  }
  const range = businessDayRange(7, new Date('2026-10-11T04:00:00.000Z'));
  assert.match(range.from, DATE_ONLY);
  assert.match(range.to, DATE_ONLY);
});
