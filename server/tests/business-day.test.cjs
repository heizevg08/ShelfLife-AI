const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  BUSINESS_TIME_ZONE,
  businessCalendarDate,
  businessDateString,
  businessDayBounds,
  previousBusinessDayBounds,
  recentBusinessCalendarBounds,
  businessDayBoundsForCalendarDate,
  dateOnlyCalendarString,
} = require('../dist/utils/business-day');

const iso = date => date.toISOString();

test('the business timezone is the fixed Philippine zone', () => {
  assert.equal(BUSINESS_TIME_ZONE, 'Asia/Manila');
});

test('an instant is read as a Philippine calendar date, not a local one', () => {
  // 23:59 UTC is already the next Philippine date (UTC+8).
  assert.equal(businessDateString(new Date('2026-10-10T23:59:00.000Z')), '2026-10-11');
  assert.deepEqual(businessCalendarDate(new Date('2026-10-10T23:59:00.000Z')), { year: 2026, month: 10, day: 11 });
});

test('midnight in Manila is the boundary between two Philippine dates', () => {
  // 2026-10-11T00:00 Manila == 2026-10-10T16:00 UTC.
  const midnight = new Date('2026-10-10T16:00:00.000Z');
  assert.equal(businessDateString(midnight), '2026-10-11');
  assert.equal(businessDateString(new Date('2026-10-10T15:59:59.999Z')), '2026-10-10');
});

test('the instant before midnight stays on the current Philippine day', () => {
  const justBefore = new Date('2026-10-10T15:59:59.999Z');
  const bounds = businessDayBounds(justBefore);
  assert.equal(iso(bounds.start), '2026-10-09T16:00:00.000Z');
  assert.equal(iso(bounds.end), '2026-10-10T16:00:00.000Z');
});

test('a day window includes its start and excludes its end', () => {
  const bounds = businessDayBounds(new Date('2026-10-10T05:00:00.000Z'));
  const atStart = bounds.start.getTime();
  const atEnd = bounds.end.getTime();
  assert.ok(atStart >= bounds.start.getTime(), 'the start instant belongs to the day');
  assert.ok(atEnd >= bounds.end.getTime(), 'the end instant does not belong to the day');
  // The window is exactly 24 hours: the zone never shifts by an hour.
  assert.equal(atEnd - atStart, 24 * 60 * 60 * 1000);
});

test('yesterday is the Philippine day before the reference instant', () => {
  // 00:30 Manila on the 11th is still 16:30 UTC on the 10th; yesterday is the 10th.
  const bounds = previousBusinessDayBounds(new Date('2026-10-10T16:30:00.000Z'));
  assert.equal(iso(bounds.start), '2026-10-09T16:00:00.000Z');
  assert.equal(iso(bounds.end), '2026-10-10T16:00:00.000Z');
});

test('recent ranges count Philippine dates, not elapsed hours', () => {
  const bounds = recentBusinessCalendarBounds(new Date('2026-10-10T18:00:00.000Z'), 7);
  // Seven Philippine dates ending 2026-10-11: the 5th through the 11th.
  assert.equal(iso(bounds.start), '2026-10-04T16:00:00.000Z');
  assert.equal(iso(bounds.end), '2026-10-11T16:00:00.000Z');
  assert.throws(() => recentBusinessCalendarBounds(new Date(), 0), RangeError);
});

test('calendar-date filters resolve to Philippine day boundaries', () => {
  const bounds = businessDayBoundsForCalendarDate('2026-10-11');
  assert.equal(iso(bounds.start), '2026-10-10T16:00:00.000Z');
  assert.equal(iso(bounds.end), '2026-10-11T16:00:00.000Z');
  assert.throws(() => businessDayBoundsForCalendarDate('10/11/2026'), RangeError);
});

test('month-end and year-end roll over on the Philippine calendar', () => {
  // 10:00 UTC on the 31st is 18:00 Manila, so the business day is still the 31st.
  const monthEnd = businessDayBounds(new Date('2026-01-31T10:00:00.000Z'));
  assert.equal(iso(monthEnd.start), '2026-01-30T16:00:00.000Z');
  assert.equal(iso(monthEnd.end), '2026-01-31T16:00:00.000Z');

  // The next Philippine date after 31 January is 1 February, never the 32nd.
  assert.equal(businessDateString(new Date('2026-02-01T02:00:00.000Z')), '2026-02-01');
  assert.equal(iso(previousBusinessDayBounds(new Date('2026-02-01T02:00:00.000Z')).start), '2026-01-30T16:00:00.000Z');

  const yearEnd = businessDayBounds(new Date('2026-12-31T10:00:00.000Z'));
  assert.equal(iso(yearEnd.start), '2026-12-30T16:00:00.000Z');
  assert.equal(iso(yearEnd.end), '2026-12-31T16:00:00.000Z');

  const newYear = businessDayBounds(new Date('2027-01-01T02:00:00.000Z'));
  assert.equal(iso(newYear.start), '2026-12-31T16:00:00.000Z');
  assert.equal(iso(newYear.end), '2027-01-01T16:00:00.000Z');
});

test('boundaries do not depend on the host machine timezone', () => {
  const probe = `
    const { businessDateString, businessDayBounds } = require(${JSON.stringify(path.join(__dirname, '../dist/utils/business-day'))});
    const bounds = businessDayBounds(new Date('2026-10-10T18:00:00.000Z'));
    console.log(JSON.stringify([businessDateString(new Date('2026-10-10T15:59:59.999Z')), bounds.start.toISOString(), bounds.end.toISOString()]));
  `;
  const results = ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'].map(zone => {
    const run = spawnSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(run.status, 0, `probe failed under TZ=${zone}: ${run.stderr}`);
    return run.stdout.trim();
  });
  for (const result of results) assert.equal(result, results[0]);
  assert.equal(JSON.parse(results[0])[0], '2026-10-10');
});

test('date-only fields keep their calendar date in any host timezone', () => {
  // A batch received on 2026-10-11 is stored as that date at UTC midnight.
  const stored = new Date(Date.UTC(2026, 9, 11));
  assert.equal(dateOnlyCalendarString(stored), '2026-10-11');
  assert.equal(businessDateString(stored), '2026-10-11');

  const probe = `
    const { dateOnlyCalendarString } = require(${JSON.stringify(path.join(__dirname, '../dist/utils/business-day'))});
    console.log(dateOnlyCalendarString(new Date(Date.UTC(2026, 9, 11))));
  `;
  for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    const run = spawnSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.equal(run.stdout.trim(), '2026-10-11', `date-only shift under TZ=${zone}`);
  }
});

test('FEFO ordering stays a whole-day comparison after timezone work', () => {
  // FEFO orders batches by expirationDate, which is a date-only value compared
  // as instant milliseconds; the same two dates must keep their order because
  // the business-day helpers never rewrite those stored values.
  const earlier = new Date(Date.UTC(2026, 9, 11));
  const later = new Date(Date.UTC(2026, 9, 20));
  assert.ok(earlier.getTime() < later.getTime());
  assert.equal(dateOnlyCalendarString(earlier), '2026-10-11');
  assert.equal(dateOnlyCalendarString(later), '2026-10-20');
});
