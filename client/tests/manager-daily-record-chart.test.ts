import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyRecordPoints, dailyAxisScale } from '../src/components/application/ManagerDailyRecordChart';
import { readFileSync } from 'node:fs';

test('selected calendar days include true zero observations between backend records', () => {
  assert.deepEqual(dailyRecordPoints('2026-10-09', '2026-10-11', [{ date: '2026-10-09', count: 2 }, { date: '2026-10-11', count: 1 }], [{ date: '2026-10-10', count: 3 }]), [
    { date: '2026-10-09', usage: 2, waste: 0 },
    { date: '2026-10-10', usage: 0, waste: 3 },
    { date: '2026-10-11', usage: 1, waste: 0 },
  ]);
});

test('Today stays a single day and all dates uses observed endpoints', () => {
  assert.deepEqual(dailyRecordPoints('2026-10-11', '2026-10-11', [{ date: '2026-10-11', count: 1 }], []), [{ date: '2026-10-11', usage: 1, waste: 0 }]);
  assert.deepEqual(dailyRecordPoints(null, null, [{ date: '2026-10-09', count: 1 }], [{ date: '2026-10-11', count: 2 }]).map(point => point.date), ['2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(dailyRecordPoints(null, null, [], []), []);
});

test('the Y axis shows whole record counts on a readable 1-2-5 scale', () => {
  // Record counts are integers, so a fractional tick would be meaningless.
  assert.deepEqual(dailyAxisScale(0), { step: 1, ceiling: 0, ticks: [0] });
  assert.deepEqual(dailyAxisScale(2), { step: 1, ceiling: 2, ticks: [0, 1, 2] });
  assert.deepEqual(dailyAxisScale(3), { step: 1, ceiling: 3, ticks: [0, 1, 2, 3] });
  // The previous fixed step produced 2, 4, 6, 8 here; the scale must stay a whole
  // readable step instead.
  assert.deepEqual(dailyAxisScale(8).ticks, [0, 2, 4, 6, 8]);
  assert.deepEqual(dailyAxisScale(12).ticks, [0, 5, 10, 15]);
  assert.deepEqual(dailyAxisScale(40).ticks, [0, 10, 20, 30, 40]);
  assert.deepEqual(dailyAxisScale(125).ticks, [0, 50, 100, 150]);
  for (const peak of [0, 1, 2, 3, 5, 7, 8, 12, 19, 40, 99, 100, 137, 1024]) {
    const { step, ceiling, ticks } = dailyAxisScale(peak);
    assert.ok(Number.isInteger(step) && step >= 1, `step ${step} is a whole number`);
    assert.equal(ticks[0], 0, 'the axis always starts at zero');
    assert.equal(ticks.at(-1), ceiling, 'the top tick is the ceiling');
    assert.ok(ceiling >= peak, `ceiling ${ceiling} covers peak ${peak}`);
    assert.ok(ticks.length <= 6, 'the axis stays readable');
    assert.ok(ticks.every(value => Number.isInteger(value)), 'no fractional record counts');
  }
  // Both series share this one scale, so an empty period cannot divide by zero. An
  // empty period takes the reference's short ladder instead, which is why the ceiling is
  // conditional: the extra gridlines carry no numbers, so nothing is claimed.
  const chart = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
  assert.match(chart, /const ceiling = allZero \? 3 : Math\.max\(1, scale\.ceiling\);/);
  assert.match(chart, /const gridValues = allZero \? \[0, 1, 2, 3\] : scale\.ticks;/);
});

test('a seven-day range labels every weekday and never thins them', () => {
  const chart = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
  // The weekday is read in UTC because the value is already a business calendar day.
  assert.match(chart, /weekday: 'long', timeZone: 'UTC'/);
  assert.match(chart, /const useWeekdayLabels = dateAxis === 'calendar-week' \|\| \(dateAxis === 'reference' && points\.length <= 7\);/);
  assert.match(chart, /const labelEvery = points\.length <= 7 \? 1 : Math\.max\(1, Math\.ceil\(points\.length \/ 7\)\);/);
  const week = dailyRecordPoints('2026-10-05', '2026-10-11', [], []).map(point => point.date);
  assert.equal(week.length, 7, 'a week has exactly seven daily positions');
  assert.deepEqual(week.map(date => new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
});

test('exact counts use accessible chart-point interactions without a redundant expandable table', () => {
  const source = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /onMouseEnter|onFocus/);
  assert.match(source, /onClick/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /<details|View exact daily counts|sl-manager-daily-table/);
});

test('an empty period keeps its axes, date labels and a truthful empty message', () => {
  const source = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  // A period with no records still draws the plot frame, so the Manager reads which
  // window was queried instead of seeing a panel that could equally be a failed load.
  // A day with NO measurement counts as empty too: a chart of entirely unmeasured days
  // is not a chart of zeroes, and must not be given a value axis.
  assert.match(source, /const allZero = measuredValues\.length === 0 \|\| measuredValues\.every\(value => value === 0\);/);
  // The axis ticks are never conditional on data: they come from the scale alone. An
  // empty period draws the reference's short ladder, but only the zero baseline is
  // numbered - the other lines carry no value that was not measured.
  assert.match(source, /gridValues\.map\(value => <g key=\{value\}>/);
  assert.match(source, /\(\!allZero \|\| \(showEmptyZeroTick && value === 0\)\) && <text className="sl-manager-daily-axis"/);
  // Date labels are drawn for empty periods too, through the shared label helper that
  // keeps the last day named without letting two labels collide.
  assert.match(source, /dateAxis === 'rolling' \? rollingIndices\(\) : axisLabelIndices\(points\.length, labelEvery\)/);
  // The markers and lines are dropped only because a flat line on the zero gridline
  // would be indistinguishable from the axis itself.
  assert.match(source, /allZero && emptyLabel && <div className="sl-manager-daily-empty" role="status">/);
  // The rule is SHARED with Manager Forecasting rather than copied for it, so any page
  // that mounts the reference chart is styled by this one declaration.
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-mgr-fc-preview,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-daily-empty \{[^}]*pointer-events: none;/);
  // The reference sets the plot on a faint inset panel, and the empty panel overlays it
  // rather than replacing it: the axes and date labels must survive an empty period.
  assert.match(source, /sl-manager-daily-plot/);
  assert.match(source, /sl-manager-daily-empty-title/);
  // A zero period still yields one bucket per calendar day, so the labels are real dates.
  const week = dailyRecordPoints('2026-10-05', '2026-10-11', [], []);
  assert.equal(week.length, 7);
  assert.ok(week.every(point => point.usage === 0 && point.waste === 0));
  // An empty scale stays a truthful integer baseline rather than an invented ceiling.
  const measured = week.flatMap(point => [point.usage, point.waste]).filter((value): value is number => value !== null);
  assert.deepEqual(dailyAxisScale(Math.max(0, ...measured)), { step: 1, ceiling: 0, ticks: [0] });
});

test('a crowded period narrows the pointer target so it never reaches the next day', () => {
  const source = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
  // Every day keeps an invisible circle wide enough to aim at, and the visible dot is
  // always painted - a narrower hit target must never hide a real observation.
  assert.match(source, /const dayPitch = points\.length > 1 \? plotWidth \/ \(points\.length - 1\) : plotWidth;/);
  assert.match(source, /const hitRadius = Math\.max\(5, Math\.min\(12, dayPitch \/ 2 - 0\.5\)\);/);
  assert.match(source, /r=\{hitRadius\}/);
  assert.match(source, /className="sl-manager-daily-point"/);
  // The same arithmetic the component runs, checked at the two extremes: a week is
  // roomy enough to keep the full 12px target, while a month must stop short of half
  // the 21px day pitch or two neighbouring days would claim the same pointer position.
  const radius = (plotWidth: number, days: number) => Math.max(5, Math.min(12, (plotWidth / (days - 1)) / 2 - 0.5));
  assert.equal(radius(680, 7), 12, 'a week keeps the generous target');
  const monthPitch = 680 / 30;
  assert.ok(radius(680, 31) < monthPitch / 2, 'a month target stays inside its own day');
  // A single-day period has no pitch to divide by, so it must still get a usable target.
  assert.ok(radius(680, 1) >= 5);
});
