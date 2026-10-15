import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
const patterns = readFileSync(new URL('../src/components/application/ApplicationPatterns.tsx', import.meta.url), 'utf8');
const dailyChart = readFileSync(new URL('../src/components/application/ManagerDailyRecordChart.tsx', import.meta.url), 'utf8');
const usageService = readFileSync(new URL('../src/services/usage-records.ts', import.meta.url), 'utf8');
const wasteService = readFileSync(new URL('../src/services/waste-records.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('the two Manager analytics cards render live data instead of a placeholder', () => {
  // Each card must be driven by the analytics response, so a placeholder cannot
  // silently return once the endpoint exists.
  for (const title of ['Usage vs Waste', 'Waste by Reason']) {
    assert.ok(page.includes(title), `${title} card is missing`);
  }
  assert.equal(page.includes('Usage and waste trends will appear when historical analytics are available.'), false);
  assert.equal(page.includes('Waste-reason analytics will appear when aggregated data is available.'), false);
  assert.equal(page.includes('Ingredient waste rankings will appear when analytics are available.'), false);
  assert.doesNotMatch(page, /Top Ingredients by Waste/);
  assert.match(page, /ManagerDailyRecordChart/);
  assert.match(page, /ApplicationBarBreakdown/);
});

test('every card keeps truthful loading, error and empty states', () => {
  assert.match(page, /kind="error" title="Analytics unavailable"/);
  assert.match(page, /kind="loading" title="Loading analytics"/);
  assert.match(page, /emptyDescription="Once you add records, your daily trend will show up here."/);
  // The reason card keeps its own hierarchy in an empty period instead of swapping the
  // whole body for one generic state, so its empty copy lives in the compact explainer
  // that stands where the bars would be.
  assert.match(page, /No waste records in this period\./);
  // A fixed period (Today, the current week, the current month) must still draw its zero
  // buckets, so the empty state is driven by the calendar series being empty
  // rather than by a zero total.
  // The chart keeps its plot and axes when a period is empty, so the cards are never
  // replaced by a generic state: the centred panel overlays the plot instead.
  assert.match(page, /emptyDescription="Once you add records, your daily trend will show up here."/);
  assert.equal(page.includes('!dailyPoints.length ? <DataState'), false);
  // Each card reports its own failure and emptiness, since each has its own period.
  assert.match(page, /reasonFailed \? <DataState kind="error" title="Analytics unavailable"/);
  // The reason card now renders its own breakdown, so emptiness is a branch inside the
  // card rather than a replacement for the whole body. The card keeps its whole
  // hierarchy in an empty period - tiles, a compact explainer where the bars would
  // be, and every reason still listed as a chip.
  assert.match(page, /reasonAnalytics\.total === 0 && <div className="sl-manager-reason-empty">/);
  assert.match(page, /sl-manager-reason-zeroes/);
});

test('the trend card carries the paired Usage/Waste peak callouts under the plot', () => {
  // Superseded: the compact `Used:`/`Wasted:` pills. The user restored the earlier
  // approved paired insight blocks, so the trend card renders one grid of two callouts
  // under the plot, each generated from the same daily counts the lines are drawn from.
  assert.match(page, /<div className="sl-manager-insight-pair" aria-label="Usage and waste peak observations">/);
  assert.match(page, /<p className="sl-manager-insight" data-tone="usage"><ManagerInsightText text=\{dailyPeakInsight\(dailyPoints, 'usage', usagePeriod\)\}/);
  assert.match(page, /<p className="sl-manager-insight" data-tone="waste"><ManagerInsightText text=\{dailyPeakInsight\(dailyPoints, 'waste', usagePeriod\)\}/);
  // The pair is a real grid wrapper, which is what keeps it even on desktop and stacked
  // below the existing mobile breakpoint.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-insight-pair \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  // The totals still come from the chart's own daily series, never from a recount of the
  // fetched record page: a paginated lookup would report a smaller number than the card.
  assert.equal(/Used: <strong>\{pageRecords\.length/.test(page), false);
  // The pill markup and its rules are retired, not left as a second presentation of the
  // same two totals.
  assert.doesNotMatch(page, /sl-manager-record-pill/);
  assert.doesNotMatch(css, /\.sl-manager-usage-live \.sl-manager-record-pill \{/);
});

test('the empty plot carries a rounded panel with its explanation', () => {
  assert.match(dailyChart, /sl-manager-daily-plot/);
  assert.match(dailyChart, /allZero && emptyLabel && <div className="sl-manager-daily-empty" role="status">/);
  assert.match(dailyChart, /sl-manager-daily-empty-title/);
  assert.match(dailyChart, /sl-manager-daily-empty-text/);
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-daily-empty \{[^}]*border-radius: var\(--sl-radius-lg\);[^}]*pointer-events: none;/);
  // The panel must stay out of the way of the plot while its buttons stay clickable.
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-daily-empty-actions \{[^}]*pointer-events: auto;/);
});

test('the charts aggregate on the server instead of summing the fetched table page', () => {
  // Reading the 150-row page into a total would under-report once history grows.
  assert.match(page, /getUsageAnalytics\(query, signal\)/);
  assert.match(page, /getWasteAnalytics\(query, signal\)/);
  assert.equal(/analytics[\s\S]{0,80}records\s*\?\?\s*\[\]/.test(page), false);
  assert.match(usageService, /\/usage-records\/analytics/);
  assert.match(wasteService, /\/waste-records\/analytics/);
});

test('the charts follow their own analytics period and ingredient filters, not table range or search', () => {
  assert.match(page, /useEffect\(\(\) => \{[\s\S]*?\[usagePeriod, category, ingredientFilter, analyticsRevision\]\)/);
  assert.match(page, /useEffect\(\(\) => \{[\s\S]*?\[wastePeriod, category, ingredientFilter, analyticsRevision\]\)/);
  assert.match(page, /value === 'Today' \? businessDayRange\(1\) : value === 'Weekly' \? businessWeekRange\(\) : businessMonthRange\(\)/);
  assert.match(page, /ingredientId: ingredientFilter \|\| undefined/);
  assert.match(page, /category: category \|\| undefined/);
  assert.match(page, /activityDateMatches\(record\.operationalDate, range, from, to\)/);
  // Search must not be part of the chart scope, or typing would move the charts.
  const effectBody = page.slice(page.indexOf('getUsageAnalytics(query'), page.indexOf('[usagePeriod, category, ingredientFilter, analyticsRevision]'));
  assert.equal(effectBody.includes('search'), false);
});

test('the chart labels name record counts, never quantities or money', () => {
  // A count is unit-free; a summed quantity would mix kilograms with litres.
  // Only the reason card has a user-facing period subtitle.
  assert.equal(page.includes('Daily records · '), false);
  assert.equal(page.includes('Waste record counts by reason · '), false);
  assert.match(page, /<h2 className="sl-card-title">Usage vs Waste Trend<\/h2>/);
  assert.match(page, /<h2 className="sl-card-title">Waste by Reason<\/h2>/);
  assert.match(page, /ariaLabel="Daily usage and waste record counts for the selected period"/);
  assert.match(page, /ariaLabel="Waste record counts by reason for the selected period"/);
  assert.equal(page.includes('Record counts by reason'), false);
  // Scope the ban to the analytics block: the KPI strip above it is a separate,
  // pre-existing surface and is deliberately not part of this change.
  const chartBlock = page.slice(page.indexOf('<div className="sl-manager-usage-analytics">'), page.indexOf('sl-manager-usage-records'));
  assert.ok(chartBlock.includes('ApplicationBarBreakdown'), 'the analytics block was not located');
  for (const banned of ['kg wasted', 'total cost', '₱', 'litres wasted', 'Lost revenue', 'wasteCost']) {
    assert.equal(chartBlock.includes(banned), false, `the cards must not claim ${banned}`);
  }
});

test('the daily chart and reason bars stay readable when the container is narrow', () => {
  assert.match(patterns, /export function ApplicationBarBreakdown/);
  assert.match(dailyChart, /export function ManagerDailyRecordChart/);
  assert.match(dailyChart, /role="button"/);
  assert.match(dailyChart, /aria-live="polite"/);
  assert.doesNotMatch(dailyChart, /View exact daily counts|<details/);
  assert.match(dailyChart, /ResizeObserver/);
  assert.match(patterns, /role="group" aria-label=\{ariaLabel\}/);
  assert.match(patterns, /item\.value\.toLocaleString\(\)/);
  assert.doesNotMatch(page, /<ApplicationBarBreakdown ranked/);
  // A bar is sized against the largest value, so the widest row always fills the track.
  assert.match(patterns, /Math\.max\(largest, item\.value\)/);
  assert.match(css, /\.sl-application-bar-row \{[\s\S]*?grid-template-columns: minmax\(0,8rem\) minmax\(0,1fr\) auto/);
  assert.match(css, /@media \(width<=420px\)\{[\s\S]*?\.sl-application-bar-row \{/);
  // Full ingredient names wrap rather than disappearing into a hover-only title.
  assert.match(css, /\.sl-application-bar-label \{[\s\S]*?overflow-wrap: anywhere/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics \{ grid-template-columns: minmax\(0,1\.9fr\) minmax\(17rem,1fr\); align-items: stretch; \}/);
  // The two cards share one desktop grid row, so the grid stretches both to the row height
  // and their top and bottom edges line up. The row height still comes from the content.
  assert.doesNotMatch(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics \{ grid-template-columns: minmax\(0,1\.9fr\) minmax\(17rem,1fr\); align-items: start; \}/);
  assert.doesNotMatch(page, /Table: first 150 recent records per type/);
  assert.match(page, /collectRecordPages\(page => listUsageRecords/);
  assert.match(page, /collectRecordPages\(page => listWasteRecords/);
  assert.doesNotMatch(page, /Showing recent records only/);
});

test('both analytics cards drop the header divider and are not force-stretched', () => {
  // The approved reference shows a title, a freshness line and the controls on one
  // header row with no rule underneath, so the page cancels the app-wide divider on
  // its own two cards only. Every other card keeps the shared 1px rule.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics \.sl-card-header \{ align-items: flex-start; border-bottom: 0; \}/);
  // A divider the page cannot cancel would leave the old rule in place, so the
  // cancellation is asserted rather than merely assumed.
  assert.doesNotMatch(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics \.sl-card-header \{[^}]*border-bottom: 1px/);
  // Only the tall line chart keeps a fixed height. The shorter reason card must
  // size to its content, or its five rows leave a large empty half.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:first-child \{ min-height: 27rem; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \{ min-height: 0; \}/);
  assert.doesNotMatch(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card \{ min-height: 29rem; \}/);
});

test('the reason bars use the approved warm ramp, never the app green', () => {
  // Green means usage or healthy stock across the app. A waste reason bar must
  // not borrow it, or a bad outcome would read as good news.
  const block = css.slice(css.indexOf('.sl-manager-usage-live .sl-application-bar-track'), css.indexOf('.sl-manager-usage-live .sl-application-bar-row'));
  const tones = [...block.matchAll(/\[data-tone="([^"]+)"\] \{ background: (#[0-9a-f]{6});/g)].map(match => ({ tone: match[1], hex: match[2] }));
  assert.equal(tones.length, 5, 'all five waste reasons need an explicit bar colour');
  for (const { tone, hex } of tones) {
    const red = parseInt(hex.slice(1, 3), 16), green = parseInt(hex.slice(3, 5), 16), blue = parseInt(hex.slice(5, 7), 16);
    assert.ok(green <= Math.max(red, blue), `${tone} (${hex}) must not be green-dominant`);
    assert.ok(red >= 0xb0, `${tone} (${hex}) must stay in the warm coral-to-gold ramp`);
  }
  // The three leading reasons are the measured reference values.
  assert.match(block, /\[data-tone="expired"\] \{ background: #e76750; \}/);
  assert.match(block, /\[data-tone="spoiled"\] \{ background: #ee9144; \}/);
  assert.match(block, /\[data-tone="damaged"\] \{ background: #f0b33e; \}/);
});

test('the daily series keep the approved reference colours', () => {
  // These two hues are the approved line colours. An override here would break
  // the cross-module colour language the Dashboard established.
  assert.match(css, /--sl-manager-chart-usage: #2e7d55;/);
  assert.match(css, /--sl-manager-chart-waste: #e2574c;/);
  assert.match(css, /--sl-manager-chart-label: #19345f;/);
});

test('the legend sits in the header and toggles one series at a time', () => {
  // The approved reference puts the legend beside the card title, in the same header
  // row as the period dropdown, and its entries are buttons. Every series starts
  // visible, a press is exposed through aria-pressed, and the last visible series
  // cannot be switched off: an empty chart would be a blank panel, not a comparison.
  assert.match(page, /<div className="sl-manager-analytics-header-tools"><ManagerDailyRecordLegend visible=\{visibleSeries\} onToggle=\{toggleSeries\} \/><ManagerAnalyticsPeriod value=\{usagePeriod\}/);
  assert.match(page, /useState<Record<DailySeries, boolean>>\(\{ usage: true, waste: true \}\)/);
  // The legend now takes its labels as a parameter so the same component can serve the
  // Manager Forecasting panel; Usage & Waste passes nothing and keeps its own wording.
  assert.match(dailyChart, /export function ManagerDailyRecordLegend<K extends string = DailySeries>\(\{ visible, onToggle, labels = SERIES_LABEL as Record<K, string> \}/);
  assert.match(dailyChart, /aria-pressed=\{visible\[series\]\}/);
  assert.match(dailyChart, /className="sl-manager-analytics-legend-item"/);
  assert.match(dailyChart, /onClick=\{\(\) => \{ if \(shown > 1 \|\| !visible\[series\]\) onToggle\(series\); \}\}/);
  // A hidden series is not drawn, but it still counts towards the scale: the axes come
  // from the whole dataset for the period, so hiding a line cannot move the gridlines
  // and imply a change in activity that never happened.
  // The series are drawn from the caller's labels, in order: the two locked pages pass
  // Usage and Waste and get exactly the two lines they always drew, while Manager Alerts
  // passes three priority keys and gets three. The rule asserted here is the one that
  // matters - one line per declared series, and no line at all for an empty period.
  assert.match(dailyChart, /\{!allZero && visible\[primary\] && <path className="sl-manager-daily-area" d=\{usageArea\} \/>\}/);
  assert.match(dailyChart, /\{!allZero && seriesKeys\.filter\(key => visible\[key\]\)\.map\(key => <path key=\{key\} className="sl-manager-daily-line" data-series=\{key\} d=\{path\(key\)\} \/>\)\}/);
  // A day with no measurement never enters the scale: reading it as 0 would collapse the
  // ceiling to a value nobody measured and make the remaining line look like a rise.
  assert.match(dailyChart, /const measuredValues = points\.flatMap\(point => seriesKeys\.map\(key => point\[key\]\)\)\.filter/);
  assert.match(dailyChart, /const peak = Math\.max\(0, \.\.\.measuredValues\);/);
  assert.doesNotMatch(dailyChart, /visible\.usage \? point\.usage : 0/);
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-analytics-legend \{[^}]*display: inline-flex;/);
  assert.match(css, /:is\(\s?\.sl-manager-usage-live,\s*\.sl-mgr-forecast-page,\s*\.sl-manager-alerts-live\s?\) \.sl-manager-analytics-legend-item\[aria-pressed="false"\] \{ opacity: \.45;/);
});

test('each analytics card owns its period while the table range stays independent', () => {
  assert.match(page, /const \[usagePeriod, setUsagePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[wastePeriod, setWastePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[range, setRange\] = useState\('All dates'\)/);
  // Each card reads exactly its own period state.
  assert.match(page, /<ManagerAnalyticsPeriod value=\{usagePeriod\} onSelect=\{setUsagePeriod\} ariaLabel="Usage vs Waste date range" \/>/);
  assert.match(page, /<ManagerAnalyticsPeriod value=\{wastePeriod\} onSelect=\{setWastePeriod\} ariaLabel="Waste by Reason date range" \/>/);
  assert.match(page, /const ANALYTICS_PERIODS = \[\{ label: 'Today', value: 'Today' \}, \{ label: 'Weekly', value: 'Weekly' \}, \{ label: 'Monthly', value: 'Monthly' \}\] as const;/);
  assert.match(page, /function ManagerAnalyticsPeriod\(\{ value, onSelect, ariaLabel \}/);
  // The control reports its period through the shared dropdown, whose trigger label is
  // the selected option, so the card can only display the window it is showing.
  assert.match(page, /<FilterSelect className="sl-manager-analytics-period" ariaLabel=\{ariaLabel\} value=\{value\}/);
  assert.match(page, /FilterSelect ariaLabel="Filter usage and waste by date range" value=\{range\}/);
  assert.match(page, /onChange=\{value => \{ setRange\(value\); setFrom\(''\); setTo\(''\); setPage\(1\); \}\}/);
});

test('the reason card matches the chart card height without stretching its rows', () => {
  // The two cards share one desktop grid row and the grid stretches both, so their top and
  // bottom edges match. Inside the taller card the rows stay packed at the top: the leftover
  // height falls below the insight rather than being spread between the rows.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics \{ grid-template-columns: minmax\(0,1\.9fr\) minmax\(17rem,1fr\); align-items: stretch; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\)>\.sl-card-body \{ align-items: stretch; gap: 2rem; flex: 1 1 auto; \}/);
  // A state with no breakdown - empty, loading or error - is centred in the stretched body.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\)>\.sl-card-body>\.sl-state \{ margin: auto; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\)>\.sl-card-body \{ padding-top: \.75rem; padding-bottom: \.75rem; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-list \{ flex: 0 0 auto;/);
  // The card is a flex column so its leftover height sits below the insight row rather
  // than pushing that row up into the middle of the card.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \{ display: flex; flex-direction: column; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-card-header \{ align-items: center; padding-bottom: \.5rem; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-label \{ font-size: \.84rem; \}/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-usage-analytics>\.sl-card:nth-child\(2\) \.sl-application-bar-value \{ font-size: \.9rem; \}/);
  // The stacked breakpoint must not keep forcing equal heights.
  assert.match(css, /@media \(width<=900px\) \{\s*\.sl-manager-usage-live \.sl-manager-usage-analytics \{ grid-template-columns: minmax\(0,1fr\); \}/);
});

test('the chart header exposes a period dropdown on each card', () => {
  // One compact dropdown per card, not a segmented group: the header row also carries
  // the title, the freshness line and the legend, and three always-visible buttons
  // crowd that row at tablet width.
  assert.match(page, /<ManagerAnalyticsPeriod value=\{usagePeriod\} onSelect=\{setUsagePeriod\} ariaLabel="Usage vs Waste date range" \/>/);
  assert.match(page, /<ManagerAnalyticsPeriod value=\{wastePeriod\} onSelect=\{setWastePeriod\} ariaLabel="Waste by Reason date range" \/>/);
  assert.match(page, /className="sl-manager-analytics-period" ariaLabel=\{ariaLabel\} value=\{value\} options=\{ANALYTICS_PERIODS/);
  assert.match(page, /sl-manager-analytics-header-tools/);
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-analytics-header-tools \{[^}]*flex-wrap: wrap;/);
  // The dropdown keeps its own compact width instead of the full-width filter default.
  assert.match(css, /\.sl-manager-usage-live \.sl-manager-analytics-period \{ flex: 0 0 auto; width: auto;/);
});

test('the freshness line reports the last successful fetch, never a record timestamp', () => {
  // A timestamp is only shown once both analytics requests have resolved, and it is
  // cleared on failure, so the label can never claim a refresh that did not happen.
  assert.match(page, /setAnalyticsUpdatedAt\(new Date\(\)\)/);
  assert.match(page, /setAnalyticsFailed\(true\); setAnalyticsUpdatedAt\(null\);/);
  assert.match(page, /analyticsUpdatedAt \? <><RefreshCw size=\{12\} aria-hidden="true" \/>Last updated \{formatTopbarDateTime\(analyticsUpdatedAt\)\}<\/> : 'Last updated unavailable'/);
  // It must never be the newest record's createdAt.
  assert.equal(/Last updated[\s\S]{0,60}createdAt/.test(page), false);
  // The five-minute refresh is an approved policy, so the timer is asserted rather than
  // banned. What must stay true is that a background refresh never claims a success it
  // did not get and never blanks the figures already on screen.
  assert.match(page, /const ANALYTICS_REFRESH_MS = 5 \* 60 \* 1000;/);
  assert.match(page, /window\.setInterval\(refresh, ANALYTICS_REFRESH_MS\)/);
  assert.match(page, /window\.clearInterval\(timer\)/);
  assert.match(page, /if \(document\.hidden\) return;/);
  assert.match(page, /if \(silent\) setChartStale\(true\);/);
  assert.match(page, /if \(silent\) setReasonStale\(true\);/);
  assert.equal(/setInterval[\s\S]{0,400}setUsageAnalytics\(null\)/.test(page.slice(page.indexOf('const refresh ='), page.indexOf('}, []);'))), false);
});

test('the three date filters are independent and never disable each other', () => {
  // Authoritative rule: each analytics card owns its period and the records toolbar owns
  // a third, separate range. Analytics summarise operational trends; the records table
  // supports detailed historical lookup. No control may clear or deactivate another.
  assert.match(page, /const \[usagePeriod, setUsagePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[wastePeriod, setWastePeriod\] = useState\('Weekly'\)/);
  assert.match(page, /const \[range, setRange\] = useState\('All dates'\)/);
  // The records filter writes only records state; it must not touch an analytics period.
  assert.match(page, /onChange=\{value => \{ setRange\(value\); setFrom\(''\); setTo\(''\); setPage\(1\); \}\}/);
  assert.equal(/setRange\(value\)[\s\S]{0,160}setUsagePeriod/.test(page), false);
  assert.equal(/setRange\(value\)[\s\S]{0,160}setWastePeriod/.test(page), false);
  // Each period control binds to its own card's state, so the two cards can show
  // different windows and neither is a mirror of the other.
  assert.match(page, /<ManagerAnalyticsPeriod value=\{usagePeriod\} onSelect=\{setUsagePeriod\}/);
  assert.match(page, /<ManagerAnalyticsPeriod value=\{wastePeriod\} onSelect=\{setWastePeriod\}/);
  // Selecting one card's period must not move the other card: each control writes only
  // its own setter, which the bindings above already pin.
  const periodControls = [...page.matchAll(/<ManagerAnalyticsPeriod[^>]*>/g)].map(match => match[0]).join('\n');
  assert.equal(periodControls.includes('setUsagePeriod') && periodControls.includes('setWastePeriod'), true);
  assert.equal((periodControls.match(/setUsagePeriod/g) ?? []).length, 1);
  assert.equal((periodControls.match(/setWastePeriod/g) ?? []).length, 1);
  // No cross-filter coupling state may exist at all.
  assert.equal(page.includes('analyticsDetached'), false);
  assert.equal(page.includes('NO_ACTIVE_PRESET'), false);
  // The records Reset clears only records filters and leaves both analytics periods alone.
  assert.match(page, /const reset = \(\) => \{ setSearch\(''\); setRange\('All dates'\); setFrom\(''\); setTo\(''\); setCategory\(''\); setIngredientFilter\(''\); setPage\(1\); \};/);
  assert.equal(/const reset = \(\) => \{[\s\S]{0,200}setUsagePeriod/.test(page), false);
  assert.equal(/const reset = \(\) => \{[\s\S]{0,200}setWastePeriod/.test(page), false);
});

test('a period control press never rewrites the records custom range', () => {
  // Pressing a period changes only that card's analytics window. The toolbar's From/To
  // values are deliberately left alone, so a custom window the Manager is still reading
  // is never silently discarded.
  assert.match(page, /<ManagerAnalyticsPeriod value=\{usagePeriod\} onSelect=\{setUsagePeriod\}/);
  assert.equal(/onSelect=\{[\(\)a-zA-Z ]*=>[\s\S]{0,160}setFrom\(''\)/.test(page), false);
  assert.equal(/onSelect=\{[\(\)a-zA-Z ]*=>[\s\S]{0,160}setRange\(/.test(page), false);
});
