import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  axisLabelIndices,
  demandByUnit,
  demandUnits,
  forecastSegments,
  formatQuantity,
  isMeasured,
  missingDays,
  quantityAxisScale,
  rankInsights,
} from '../src/components/application/forecast-chart-data';
import {
  FORECAST_SAMPLE_CATEGORY_DEMAND,
  FORECAST_SAMPLE_INSIGHTS,
  FORECAST_SAMPLE_VS_ACTUAL,
} from '../src/components/application/forecast-sample-data';

// Manager Forecasting panel implementation pass (2026-10-13).
//
// The production page has no forecasting service, so these tests guard the three approved
// panel designs and the rules that keep them truthful. They run against the pure helpers
// plus source pins, in the same style as the other Manager geometry tests. Nothing here
// asserts a forecast value, because none exists.

const CHARTS = readFileSync(new URL('../src/components/application/ManagerForecastCharts.tsx', import.meta.url), 'utf8');
// The approved presentation reference: Manager Usage & Waste. The Forecasting panels
// RENDER this component rather than imitating it, so several rules below are pinned
// against this file - that is the point, one chart serves both pages.
const REFERENCE = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
const DATA = readFileSync(new URL('../src/components/application/forecast-chart-data.ts', import.meta.url), 'utf8');
const SAMPLES = readFileSync(new URL('../src/components/application/forecast-sample-data.ts', import.meta.url), 'utf8');
const PREVIEW = readFileSync(new URL('../src/app/(administration)/ForecastPreview.tsx', import.meta.url), 'utf8');
const ROUTER = readFileSync(new URL('../src/routing/router.tsx', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const STYLES = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('a missing day is never drawn as zero, and a real zero is never dropped', () => {
  // The whole point of the panel: "we did not measure" and "we measured zero" are
  // different facts and must render differently.
  assert.equal(isMeasured(null), false);
  assert.equal(isMeasured(undefined), false);
  assert.equal(isMeasured(0), true, 'a measured zero is a real value');
  assert.equal(isMeasured(8.4), true);
  assert.equal(isMeasured(Number.NaN), false, 'NaN is not a measurement');

  const points = [
    { date: '2026-10-01', forecast: 8, actual: 7 },
    { date: '2026-10-02', forecast: null, actual: 0 },
    { date: '2026-10-03', forecast: 9, actual: 8 },
  ];
  // The null ends the forecast line; the measured zero keeps the actual line running.
  assert.deepEqual(forecastSegments(points, 'forecast'), [[0], [2]]);
  assert.deepEqual(forecastSegments(points, 'actual'), [[0, 1, 2]]);
  assert.deepEqual(missingDays(points, 'forecast'), ['2026-10-02']);
  assert.deepEqual(missingDays(points, 'actual'), []);
  // No segment may span a gap: every index in a run must be measured.
  for (const key of ['forecast', 'actual'] as const) {
    for (const run of forecastSegments(points, key)) {
      assert.ok(run.every(index => isMeasured(points[index][key])), `${key} run stays inside measured days`);
    }
  }
  // The rule is enforced where the line is drawn: in the reference trend chart, which
  // these panels render rather than re-implement. Its segments break on an unmeasured day.
  assert.match(REFERENCE, /if \(typeof point\[series\] !== 'number' \|\| !Number\.isFinite\(point\[series\] as number\)\) \{ if \(run\.length\) runs\.push\(run\); run = \[\]; return; \}/);
  assert.match(CHARTS, /A missing day is left blank rather than drawn as zero\./);
  // A gap is named in words, so a Manager reads why a line stops.
  assert.match(CHARTS, /Not plotted: \$\{gaps\.join\(', '\)\}/);
});

test('the sample series and fixtures are deterministic and internally coherent', () => {
  // A fixed fixture is what makes a screenshot reproducible between runs.
  assert.equal(FORECAST_SAMPLE_VS_ACTUAL.length, 14);
  assert.deepEqual(FORECAST_SAMPLE_VS_ACTUAL.map(point => point.date), [
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
    '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
  ]);
  // Exactly one gap per series, and one deliberate true zero - the two states the design
  // must keep apart, both present in the fixture on purpose.
  assert.equal(missingDays(FORECAST_SAMPLE_VS_ACTUAL, 'forecast').length, 1);
  assert.equal(missingDays(FORECAST_SAMPLE_VS_ACTUAL, 'actual').length, 1);
  assert.ok(FORECAST_SAMPLE_VS_ACTUAL.some(point => point.actual === 0), 'the fixture carries a real zero');
  // Dates are unique and ascending, so the x axis is a real time axis.
  const dates = FORECAST_SAMPLE_VS_ACTUAL.map(point => point.date);
  assert.equal(new Set(dates).size, dates.length);
  assert.deepEqual([...dates].sort(), dates);
  // Every insight carries one ingredient, one Batch ID and a cause in words.
  for (const insight of FORECAST_SAMPLE_INSIGHTS) {
    assert.ok(insight.ingredient.length > 0);
    assert.match(insight.batchId, /^SL-\d{8}-\d{3}$/, 'Batch ID follows the canonical shape');
    assert.ok(insight.reason.length > 10 && insight.evidence.length > 10 && insight.action.length > 10);
  }
});

test('the ranked insight order is deterministic and needs no invented score', () => {
  // Worst first, from the declared tone alone. There is no approved risk formula, so an
  // ordering that needed a score could not be computed honestly.
  const ranked = rankInsights(FORECAST_SAMPLE_INSIGHTS);
  assert.deepEqual(ranked.map(insight => insight.tone), ['critical', 'attention', 'neutral']);
  assert.deepEqual(rankInsights(FORECAST_SAMPLE_INSIGHTS).map(insight => insight.id), ranked.map(insight => insight.id), 'stable across calls');
  // Reversing the input must not change the output: the order comes from the data, not
  // from the array's own sequence.
  assert.deepEqual(rankInsights([...FORECAST_SAMPLE_INSIGHTS].reverse()).map(insight => insight.id), ranked.map(insight => insight.id));
  // No card may render a score-shaped number.
  assert.doesNotMatch(CHARTS, /riskScore|riskIndex|confidenceScore|severityScore|accuracyPercent/);
  assert.match(CHARTS, /Suggestions only\. Nothing here changes stock/);
});

test('bars are ranked highest to lowest and incompatible units are never combined', () => {
  // Descending inside each unit group.
  for (const kind of ['historical', 'forecast'] as const) {
    for (const group of demandByUnit(FORECAST_SAMPLE_CATEGORY_DEMAND, kind)) {
      const values = group.items.map(item => item.value);
      assert.deepEqual(values, [...values].sort((a, b) => b - a), `${group.unit} ${kind} is ranked highest first`);
    }
  }
  // The fixture really does mix units, so the separation is being exercised rather than
  // assumed. kg, L and pcs must each land in their own group.
  assert.deepEqual([...demandUnits(FORECAST_SAMPLE_CATEGORY_DEMAND)].sort(), ['L', 'kg', 'pcs'].sort());
  const groups = demandByUnit(FORECAST_SAMPLE_CATEGORY_DEMAND, 'historical');
  assert.equal(groups.length, 3);
  // No group may mix units: every row inside a group must belong to that group's own
  // unit. (kg legitimately holds three categories, L and pcs two each.)
  const unitsPerGroup = groups.map(group => group.items.map(row => FORECAST_SAMPLE_CATEGORY_DEMAND.find(item => item.category === row.label && item.kind === 'historical')!.unit));
  assert.ok(unitsPerGroup.every((units, index) => units.every(unit => unit === groups[index].unit)), 'no unit group contains another unit');
  assert.deepEqual(unitsPerGroup.map(units => units.length), [3, 2, 2]);
  // No group may mix units, and no total may ever span two units.
  const unitsUsed = groups.flatMap(group => FORECAST_SAMPLE_CATEGORY_DEMAND.filter(item => group.items.some(row => row.label === item.category)).map(item => item.unit));
  assert.ok(unitsUsed.every(unit => groups.some(group => group.unit === unit)));
  assert.doesNotMatch(CHARTS, /reduce\(\s*\(sum[^)]*\)\s*=>\s*sum\s*\+[^)]*\)\s*,\s*0\s*\)\s*\/\s*units\.length/);
  // The panel states the rule on screen, and labels each unit block.
  assert.match(CHARTS, /Quantities in different units are never added together or ranked against each other\./);
  assert.match(CHARTS, /Measured in \{unit\}/);
  // Historical and forecast are drawn as separate rows, so they are never summed either.
  assert.match(CHARTS, /Historical demand/);
  assert.match(CHARTS, /Forecast demand/);
});

test('the date axis never crowds the last two labels into each other', () => {
  // A short window names every day, including the final one.
  assert.deepEqual(axisLabelIndices(7, 1), [0, 1, 2, 3, 4, 5, 6]);
  // Fourteen days thin to every other day. The last regular label (day 12) sits one slot
  // before the final day, which is the collision seen on a phone, so it is dropped and the
  // final day is named instead.
  assert.deepEqual(axisLabelIndices(14, 2), [0, 2, 4, 6, 8, 10, 13]);
  // The label immediately before the final day is dropped when it would collide.
  assert.deepEqual(axisLabelIndices(13, 2), [0, 2, 4, 6, 8, 10, 12]);
  // When the regular grid already ends on the final day, nothing is dropped: 14 is a
  // multiple of 2, so every label keeps its even spacing.
  assert.deepEqual(axisLabelIndices(15, 2), [0, 2, 4, 6, 8, 10, 12, 14]);
  // A single day and an empty window are both safe.
  assert.deepEqual(axisLabelIndices(1, 1), [0]);
  assert.deepEqual(axisLabelIndices(0, 2), []);
  for (const length of [1, 2, 5, 13, 14, 30, 31, 90]) {
    for (const every of [1, 2, 3, 7]) {
      const indices = axisLabelIndices(length, every);
      assert.equal(indices[indices.length - 1], length - 1, `the final day is always named (length ${length}, every ${every})`);
      // No two drawn labels may touch. A short window deliberately names every day
      // (every = 1), where a single-day gap is the intent rather than a collision.
      if (every > 1) for (let position = 1; position < indices.length; position += 1) assert.ok(indices[position] - indices[position - 1] > 1, `drawn labels keep a gap (length ${length}, every ${every})`);
    }
  }
  // The component consults the shared helper rather than labelling every index itself.
  // That helper now lives with the reference trend chart the panel renders, so one label
  // rule serves both pages instead of each keeping its own copy.
  assert.match(REFERENCE, /dateAxis === 'rolling' \? rollingIndices\(\) : axisLabelIndices\(points\.length, labelEvery\)/);
});

test('the chart names its two series through the reference chart and never borrows the usage/waste wording', () => {
  // The panel renders the Usage & Waste trend chart itself, so the series names are
  // supplied to that component as labels. It must not restate them as Usage/Waste.
  assert.match(CHARTS, /const FORECAST_LABELS: Record<DailySeries, string> = \{ usage: 'Forecast', waste: 'Actual' \};/);
  assert.match(CHARTS, /const SERIES_ORDER: readonly ForecastSeriesKey\[\] = \['forecast', 'actual'\];/);
  assert.match(CHARTS, /labels=\{FORECAST_LABELS\}/);
  // The legend is the reference legend itself, driven by the same labels, and it refuses
  // to hide the last visible series.
  assert.match(REFERENCE, /export function ManagerDailyRecordLegend<K extends string = DailySeries>\(\{ visible, onToggle, labels = SERIES_LABEL as Record<K, string> \}/);
  assert.match(REFERENCE, /shown === 1 && visible\[series\] \? 'At least one series must stay visible'/);
  // Ingredient and unit are stated, so a bare number can never be misread.
  assert.match(CHARTS, /<strong>\{meta\.ingredient\}<\/strong>/);
  assert.match(CHARTS, /\{meta\.unit\}/);
  assert.match(CHARTS, /forecast made \{dateLabel\(meta\.asOf\)\}\r?\n\s*<span aria-hidden="true"> · <\/span>\{meta\.horizonDays\}-day horizon/);
  // The subject line states a forecast date and horizon, so it is drawn only when a
  // forecast is actually plotted - never alongside an empty chart.
  assert.match(CHARTS, /\{drawable && <p className="sl-mgr-fc-subject">/);
  // The chart is NOT the Usage vs Waste trend: none of its series wording may appear.
  assert.doesNotMatch(CHARTS, /Usage series|Waste series|usage and waste record counts/i);
  // Production still pending: the pipeline is not connected.
  assert.match(CHARTS, /never fetch, never\s*\/\/\s*compute a prediction and never invent a value/);
});

test('the chart reuses the established axis grammar and keeps fractional quantities readable', () => {
  // Ingredient quantities are real numbers, so the axis may step fractionally - unlike the
  // record-count chart, which must never show a fraction.
  assert.deepEqual(quantityAxisScale(0), { step: 1, ceiling: 0, ticks: [0] });
  assert.deepEqual(quantityAxisScale(9.4), { step: 2.5, ceiling: 10, ticks: [0, 2.5, 5, 7.5, 10] });
  assert.deepEqual(quantityAxisScale(40), { step: 10, ceiling: 40, ticks: [0, 10, 20, 30, 40] });
  for (const peak of [0, 0.5, 1, 2.4, 7.6, 9.4, 62.4, 940, 1015]) {
    const { step, ceiling, ticks } = quantityAxisScale(peak);
    assert.ok(step > 0, `step is positive for ${peak}`);
    assert.equal(ticks[0], 0, 'the axis starts at zero');
    assert.equal(ticks.at(-1), ceiling, 'the top tick is the ceiling');
    assert.ok(ceiling >= peak, `ceiling ${ceiling} covers peak ${peak}`);
    assert.ok(ticks.length <= 6, 'the axis stays readable');
    assert.ok(ticks.every(value => Number.isFinite(value)));
  }
  assert.equal(formatQuantity(8), '8');
  assert.equal(formatQuantity(8.4), '8.4');
});

test('the preview is development-only, unreachable in production and not linked anywhere', () => {
  // Guard 1: the route is registered only in development.
  assert.match(ROUTER, /const devRoutes = import\.meta\.env\.DEV\s*\r?\n\s*\? \[createRoute\(\{/);
  assert.match(ROUTER, /path: '\/ForecastPreview'/);
  assert.match(ROUTER, /: \[\];/);
  assert.match(ROUTER, /workspace\.addChildren\(\[\.\.\.protectedRoutes, \.\.\.devRoutes\]\)/);
  // Guard 2: the page itself renders nothing outside development.
  assert.match(PREVIEW, /if \(!import\.meta\.env\.DEV\) return null;/);
  // Guard 3: no workspace navigation links to it.
  const WORKSPACE = readFileSync(new URL('../src/components/application/workspace.ts', import.meta.url), 'utf8');
  // The shell's own gate must also admit the preview in development. It is deliberately NOT
  // added to the canonical workspace table, because that table registers modules a role is
  // granted and nobody is granted a preview - so the check is on the build, not the role.
  const WORKSPACE_SRC = readFileSync(new URL('../src/components/application/workspace.ts', import.meta.url), 'utf8');
  assert.match(WORKSPACE_SRC, /if \(pathname === '\/ForecastPreview'\) return import\.meta\.env\.DEV;/);
  assert.doesNotMatch(WORKSPACE_SRC, /'\/ForecastPreview': \[/);
  assert.doesNotMatch(PAGE, /ForecastPreview/);
  // The banner is the first thing on the page, and it says what the numbers are.
  assert.match(PREVIEW, /SAMPLE DATA — UI PREVIEW ONLY\./);
  assert.match(PREVIEW, /They are not model output, they are not historical records, and no forecasting service is connected\./);
  assert.match(PREVIEW, /role="note"/);
});

test('no sample value can leak into the production Manager Forecasting page', () => {
  // The production page must not import the fixtures at all, in either direction.
  const start = PAGE.indexOf('function ManagerForecastingPage()');
  const end = PAGE.indexOf('function ManagerChangeRequestsPage()', start);
  const managerForecast = PAGE.slice(start, end > -1 ? end : undefined);
  assert.ok(start > -1 && managerForecast.length > 500, 'the Manager Forecasting page is found');
  assert.doesNotMatch(managerForecast, /forecast-sample-data|FORECAST_SAMPLE|CategoryDemandBreakdown/);
  assert.doesNotMatch(PAGE, /FORECAST_SAMPLE/);
  // It keeps every truthful pending state and every dash.
  assert.match(managerForecast, /<Card id="mgr-forecast-v-actual" title="Forecast vs\. Actual"/);
  assert.doesNotMatch(managerForecast, /mgr-category-demand|CategoryDemandEmpty/);
  assert.match(managerForecast, /<Card id="mgr-forecast-insights" title="Forecast Insights">/);
  // The approved framework falls back to trendWindow and ForecastInsightsEmpty when no live records exist.
  assert.match(managerForecast, /<ForecastVsActualChart ariaLabel="Forecast versus actual ingredient consumption by date" points=\{[^}]*trendWindow\}/);
  // The window is the selected period's own dates, every one of them absent. This is what
  // keeps the reference chart's date axis and gridlines alive; it must never become a real
  // value or a measured zero.
  assert.match(managerForecast, /const trendWindow = emptyForecastWindow\(trendFrom, trendTo\);/);
  assert.match(managerForecast, /trendPeriod === 'This Week' \? businessWeekRange\(\) : businessDayRange\(trendDays\)/);
  assert.match(managerForecast, /<ForecastInsightsEmpty \/>/);
  // The fixtures are labelled as invented in their own file too, so a reader of the data
  // module cannot mistake them for measurements.
  assert.match(SAMPLES, /is invented and internally consistent\s+\/\/ on purpose/);
  assert.match(SAMPLES, /Only the development-only preview page imports this file\./);
  // The production page must not import the fixtures module at all, in either direction.
  assert.doesNotMatch(PAGE, /forecast-sample-data/);
  // The helpers module carries no fixture value, so importing a chart cannot pull one in.
  assert.doesNotMatch(DATA, /FORECAST_SAMPLE_/);
});

test('Manager-only authorization is unchanged and no module was unlocked', () => {
  const WORKSPACE = readFileSync(new URL('../src/components/application/workspace.ts', import.meta.url), 'utf8');
  // Phase 2 of the earlier QA pass: Forecasting is Manager-only, enforced by the router
  // guard through canOpenWorkspacePath before the page renders.
  const forecastEntry = WORKSPACE.split(/\r?\n/).find(line => line.includes('/Forecasting'));
  assert.ok(forecastEntry, 'the Forecasting workspace entry exists');
  assert.match(forecastEntry!, /Manager/);
  assert.doesNotMatch(forecastEntry!, /Super Admin/);
  assert.match(ROUTER, /if \(!canOpenWorkspacePath\(user\.role, path\)\) throw redirect/);
  // The dev preview requires a session but grants nothing: it must not use the module
  // guard, and it must not appear in any role's allowed paths.
  assert.match(ROUTER, /beforeLoad: \(\) => devSessionGuard\(\)/);
  assert.match(ROUTER, /async function devSessionGuard\(\) \{/);
});

test('the new panels are contained at every width and stack on a phone', () => {
  // Every container that holds a chart must be able to shrink, or the page scrolls
  // sideways on a phone.
  for (const rule of [
    /\.sl-mgr-fc-chart \{ box-sizing: border-box; display: flex; flex-direction: column; gap: \.5rem; width: 100%; min-width: 0; padding: \.75rem 1\.25rem 0; \}/,
    /\.sl-mgr-fc-frame \{ position: relative; width: 100%; min-width: 0;/,
    /\.sl-mgr-fc-demand \{ display: flex; flex-direction: column; gap: \.75rem; min-width: 0; box-sizing: border-box; padding-inline: var\(--sl-space-4\); \}/,
    /\.sl-mgr-fc-insights \{ display: flex; flex-direction: column; gap: \.6rem; min-width: 0; \}/,
    /\.sl-mgr-fc-preview-grid \{ display: grid; grid-template-columns: repeat\(auto-fit,minmax\(min\(100%,22rem\),1fr\)\);/,
  ]) assert.match(STYLES, rule);
  // The ranked row collapses to one column before the three tracks can overflow.
  assert.match(STYLES, /@media \(width<=760px\) \{\s*\.sl-mgr-fc-demand-row \{ grid-template-columns: minmax\(0,1fr\); \}/);
  assert.match(STYLES, /@media \(width<=420px\) \{\s*\.sl-mgr-fc-subject,\.sl-mgr-fc-gap-note \{ font-size: \.78rem; \}/);
  // No absolute positioning or negative margin that could push the page wider.
  const fcRules = STYLES.slice(STYLES.indexOf('.sl-mgr-fc-chart {'));
  assert.doesNotMatch(fcRules.slice(0, 12000), /margin:\s*-|width:\s*\d{4,}px/);
  // The page-scoped palette keeps the two chart surfaces independent.
  assert.match(STYLES, /\.sl-mgr-forecast-page,\s*\.sl-mgr-fc-preview \{[^}]*--sl-mgr-fc-forecast:/);
});
