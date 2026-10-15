import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ALERT_PRIORITY_LABELS, ALERT_TREND_PERIODS, alertTrendAxis, alertTrendPoints } from '../src/components/application/ManagerAlertCharts';
import { DAILY_SERIES_LABELS, dailyRecordPoints, ManagerDailyRecordChart, ManagerDailyRecordLegend } from '../src/components/application/ManagerDailyRecordChart';

const chart = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
const alertCharts = readFileSync(new URL('../src/components/application/ManagerAlertCharts.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

// The owner approved widening the shared trend chart to a configurable series count on the
// strict condition that the two locked pages render EXACTLY as before. These tests hold
// both halves of that bargain: the two-series defaults are unchanged, and the three-series
// Alerts configuration is real rather than a copy of the chart.

test('the shared chart still defaults to exactly the two locked series, in order', () => {
  assert.deepEqual(DAILY_SERIES_LABELS, { usage: 'Usage', waste: 'Waste' });
  // The series list is derived from the labels the caller passes, so passing nothing keeps
  // the reference's own two names and order - which is what Usage & Waste relies on.
  assert.match(chart, /const seriesKeys = Object\.keys\(labels\);/);
  assert.match(chart, /const primary = seriesKeys\[0\];/);
  assert.match(chart, /labels = DAILY_SERIES_LABELS/);
  // The area still hangs off the FIRST series, as the reference draws it.
  assert.match(chart, /visible\[primary\] && measuredRuns\(primary\)\.length <= 1/);
});

test('the two-series tooltip keeps the reference\'s exact box height', () => {
  // 24 + 2 x 14 = 52, which is the height the locked panels have always rendered. A
  // three-series panel grows to 66 so its third line is never clipped.
  assert.match(chart, /const tooltipWidth = 150; const tooltipHeight = 24 \+ seriesKeys\.length \* 14;/);
  assert.equal(24 + 2 * 14, 52);
  assert.equal(24 + 3 * 14, 66);
});

test('a three-series caller is drawn from the keys it declares, never from the two defaults', () => {
  // The legend is generic over its keys, so a caller keeps the narrow type it always had.
  assert.match(chart, /export function ManagerDailyRecordLegend<K extends string = DailySeries>/);
  assert.match(chart, /const seriesKeys = Object\.keys\(labels\) as K\[\];/);
  // Alerts declares three priorities and passes its own labels through, so the chart draws
  // High, Medium and Low - not Usage and Waste with three dots.
  assert.deepEqual(Object.keys(ALERT_PRIORITY_LABELS), ['high', 'medium', 'low']);
  assert.match(alertCharts, /labels=\{ALERT_PRIORITY_LABELS\}/);
  assert.match(alertCharts, /export function AlertTrendChart/);
  // The chart component itself is mounted, not re-implemented as local markup.
  assert.match(alertCharts, /<ManagerDailyRecordChart/);
  assert.doesNotMatch(alertCharts, /<svg|<path|<circle/);
});

test('every trend point carries no measurement at all while no alert service exists', () => {
  for (const period of ALERT_TREND_PERIODS) {
    const points = alertTrendPoints(period);
    assert.ok(points.length >= 7, `${period} covers at least a week of business days`);
    for (const point of points) {
      assert.equal(point.high, null, `${period} ${point.date} high`);
      assert.equal(point.medium, null, `${period} ${point.date} medium`);
      assert.equal(point.low, null, `${period} ${point.date} low`);
      assert.equal(point.usage, null, `${period} ${point.date} slot 1`);
      assert.equal(point.waste, null, `${period} ${point.date} slot 2`);
    }
    // The dates are real business calendar days, so the chart keeps its axis.
    assert.ok(points.every(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date)));
    assert.deepEqual(points.map(point => point.date), [...points.map(point => point.date)].sort());
  }
});

test('the trend keeps the approved period contract and its two axis modes', () => {
  assert.deepEqual([...ALERT_TREND_PERIODS], ['This Week', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days']);
  // This Week is the Philippine Monday-Sunday calendar week; the numbered options are
  // inclusive rolling windows. Both are the reference chart's own modes, not new ones.
  assert.equal(alertTrendAxis('This Week'), 'calendar-week');
  for (const period of ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'] as const) assert.equal(alertTrendAxis(period), 'rolling');
  const week = alertTrendPoints('This Week');
  assert.equal(week.length, 7, 'the calendar week has exactly seven days');
  assert.deepEqual(week.map(point => new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${point.date}T00:00:00Z`))), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.equal(alertTrendPoints('Last 30 Days').length, 30);
  assert.equal(alertTrendPoints('Last 90 Days').length, 90);
});

test('the single retained trend declares the three priorities without inventing values', () => {
  const page = readFileSync(new URL('../src/app/(administration)/Alerts.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /manager-alert-priority|AlertPriorityBreakdownEmpty/);
  assert.doesNotMatch(alertCharts, /ApplicationBarBreakdown|AlertPriorityBreakdownEmpty/);
  assert.doesNotMatch(alertCharts, /\b\d+\s*(alerts?|records?)\b/i);
  assert.doesNotMatch(alertCharts, /riskScore|severity|threshold|confidence/i);
  assert.deepEqual(Object.values(ALERT_PRIORITY_LABELS), ['High', 'Medium', 'Low']);
});

test('the priority colours remain in the trend legend', () => {
  assert.match(styles, /--sl-alert-high: #e2574c;/);
  assert.match(styles, /--sl-alert-medium: #f0b33e;/);
  assert.match(styles, /--sl-alert-low: #2e7d55;/);
  assert.match(alertCharts, /function AlertTrendLegend/);
  assert.match(alertCharts, /labels=\{ALERT_PRIORITY_LABELS\}/);
});

test('the Alerts page joins the shared chart scope instead of restating the chart CSS', () => {
  // One shared selector list covers all three production chart surfaces, so a change to the
  // reference reaches every page that mounts it.
  assert.match(styles, /:is\(\.sl-manager-usage-live, \.sl-mgr-forecast-page, \.sl-manager-alerts-live\) \.sl-manager-daily-plot/);
  assert.match(styles, /:is\(\.sl-manager-usage-live, \.sl-mgr-forecast-page, \.sl-manager-alerts-live\) \.sl-manager-daily-empty \{/);
  // The locked pages' own selector form must not survive anywhere: a leftover copy is
  // exactly the drift this reuse exists to prevent.
  const lockedOnly = styles.match(/:is\(\.sl-manager-usage-live, \.sl-mgr-forecast-page\)/g) || [];
  assert.equal(lockedOnly.length, 0, 'no chart rule is scoped to the locked pages only');
});

test('the shared chart is still the one the locked pages mount', () => {
  // Usage & Waste and Forecasting keep calling the same component and the same legend.
  const usage = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
  assert.match(usage, /ManagerDailyRecordChart/);
  assert.match(usage, /ManagerDailyRecordLegend/);
  // The chart's own export names are unchanged, so no caller needed editing for this work.
  assert.equal(typeof ManagerDailyRecordChart, 'function');
  assert.equal(typeof ManagerDailyRecordLegend, 'function');
  assert.deepEqual(dailyRecordPoints('2026-10-09', '2026-10-11', [{ date: '2026-10-09', count: 2 }], [{ date: '2026-10-11', count: 1 }]), [
    { date: '2026-10-09', usage: 2, waste: 0 },
    { date: '2026-10-10', usage: 0, waste: 0 },
    { date: '2026-10-11', usage: 0, waste: 1 },
  ]);
});
