import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Manager Forecasting UI correction pass (2026-10-13).
//
// This page is a truthful pending surface: it has no forecasting API, no model and no
// stored forecast records, so every figure stays a dash and every panel says data is
// pending. These tests pin the corrections without claiming any forecasting capability
// exists - they guard structure, accessibility and the absence of fabricated values.

const PAGE = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const STYLES = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

const forecasting = () => {
  const start = PAGE.indexOf('function ManagerForecastingPage()');
  assert.ok(start > -1, 'ManagerForecastingPage exists');
  const end = PAGE.indexOf('function ManagerChangeRequestsPage()', start);
  return PAGE.slice(start, end > -1 ? end : undefined);
};

test('the eight reported dead Forecasting selectors are gone', () => {
  // Confirmed against the rendered page: 0 elements matched each class, so every rule
  // was unreachable. The live surfaces are sl-mgr-forecast-page/-analytics/-pending/
  // -records/-tablewrap/-footer, which stay.
  for (const dead of ['sl-mgr-forecast-kpis', 'sl-mgr-forecast-grid', 'sl-mgr-forecast-main', 'sl-mgr-forecast-charts', 'sl-mgr-forecast-rail', 'sl-mgr-forecast-filters', 'sl-mgr-forecast-sustainability', 'sl-mgr-forecast-table-actions']) {
    assert.doesNotMatch(STYLES, new RegExp(`\\.${dead}[\\s,{:]`), `${dead} has no rule left`);
  }
  // The live classes are still styled (sl-mgr-forecast-records is a page hook that
  // the shared records selectors reach through :is(), so it carries no rule of its own).
  for (const live of ['sl-mgr-forecast-page', 'sl-mgr-forecast-analytics', 'sl-mgr-forecast-pending', 'sl-mgr-forecast-tablewrap', 'sl-mgr-forecast-footer']) {
    assert.match(STYLES, new RegExp(`\\.${live}\\b`), `${live} keeps its rule`);
  }
  assert.match(forecasting(), /className="sl-application-records [^"]*sl-mgr-forecast-records"/);
});

test('the primary chart spans the tablet grid through the real card item', () => {
  // Card renders <section class="sl-card" aria-labelledby={id}><h2 id={id}>, so the id
  // is on the h2. A child-combinator id match can never hit the grid item.
  assert.doesNotMatch(STYLES, /\.sl-mgr-forecast-analytics>#mgr-forecast-insights/);
  assert.match(STYLES, /\.sl-mgr-forecast-analytics>\.sl-card:has\(#mgr-forecast-v-actual\) \{\s*grid-column: auto;/);
  assert.match(STYLES, /@media \(width<=760px\)\{[\s\S]*?\.sl-mgr-forecast-analytics>\.sl-card:has\(#mgr-forecast-v-actual\) \{\s*grid-column: auto;/);
  // The primary line chart owns enough desktop width for its header tools to stay level.
  assert.match(STYLES, /\.sl-mgr-forecast-analytics \{\s*grid-template-columns: minmax\(0,1\.9fr\) minmax\(17rem,1fr\);/);
});

test('the analytics cards no longer stack two minimum heights', () => {
  // The tablewrap 18.5rem minimum and the 260px in-table pending floor were both
  // removed; a single analytics-card floor remains and is smaller than before.
  assert.doesNotMatch(STYLES, /\.sl-mgr-forecast-tablewrap \{\s*min-height: 18\.5rem;/);
  assert.doesNotMatch(STYLES, /\.sl-mgr-forecast-tablewrap \.sl-mgr-forecast-pending \{[^}]*min-height/);
  assert.doesNotMatch(STYLES, /sl-mgr-forecast-pending \{ min-height: clamp\(160px,17vw,205px\); \}/);
  assert.match(STYLES, /\.sl-mgr-forecast-analytics>\.sl-card \.sl-mgr-forecast-pending \{\s*flex: 1;\s*min-height: clamp\(160px,15vw,200px\);/);
  // The compact variant had no live caller and is gone with its rule.
  assert.doesNotMatch(STYLES, /\.sl-mgr-forecast-pending\.compact/);
  assert.doesNotMatch(forecasting(), /compact = false|compact \? ' compact'/);
});

test('the category and ingredient filters draw on real master data, never forecasts', () => {
  const page = forecasting();
  // Both controls are populated from the Manager's authorized ingredient master data
  // (/ingredients/categories and /ingredients/stock-in-options), the same services the
  // approved Manager /Inventory and /UsageWaste pages already use. No forecast dataset
  // is consulted, so an option can never imply a prediction.
  assert.match(page, /Promise\.all\(\[listIngredientCategories\(controller\.signal\), listStockInIngredients\(controller\.signal\)\]\)/);
  assert.match(page, /const categoryOptions = useMemo\(\(\) => \[\{ value: '', label: 'All Categories' \}, \.\.\.\(categories \?\? \[\]\)\.map/);
  assert.match(page, /const ingredientOptions = useMemo\(\(\) => \[\{ value: '', label: 'All Ingredients' \}, \.\.\.\(ingredients \?\? \[\]\)\.filter\(item => !category \|\| item\.category === category\)/);
  // The Ingredient control follows the chosen category and clears a now-stale choice.
  assert.match(page, /onChange=\{value => \{ setCategory\(value\); setIngredient\(''\); setPage\(1\); \}\}/);
  // A control with nothing real to offer still renders disabled rather than pretending
  // to filter, and each unavailable reason is reported on its own title.
  assert.match(page, /disabled=\{categoriesUnavailable\} title=\{categoriesUnavailable \? categoryHint : 'Filter by ingredient category'\}/);
  assert.match(page, /disabled=\{ingredientsUnavailable\} title=\{ingredientsUnavailable \? ingredientHint : 'Filter by ingredient'\}/);
  assert.match(page, /const categoriesUnavailable = optionsFailed \|\| optionsLoading \|\| categoryOptions\.length <= 1;/);
  // Loading, failure and a genuinely empty master list are distinct states.
  assert.match(page, /const optionsLoading = categories === null \|\| ingredients === null;/);
  assert.match(page, /'Ingredient categories are unavailable'/);
  assert.match(page, /'No ingredients recorded in this category'/);
  // No invented ingredient or category options.
  assert.doesNotMatch(page, /value:'(Chicken|Tomato|Meat|Vegetable)/);
  // The shared FilterSelect is not modified globally: it still renders disabled from its
  // own prop and the disabled trigger keeps its own style.
  const shared = readFileSync(new URL('../src/components/application/FilterSelect.tsx', import.meta.url), 'utf8');
  assert.match(shared, /disabled = false/);
  assert.match(shared, /disabled=\{disabled\}/);
  assert.match(STYLES, /\.sl-filter-select-trigger:disabled \{/);
});

test('the forecast Custom range validates, persists and resets like the records ledgers', () => {
  const page = forecasting();
  // The same shared validity helper the Usage & Waste ledgers use, so the rules cannot
  // drift apart. No earliest-activity bound applies here: this page has no record ledger.
  // The import sits above the component, so it is read from the whole module.
  assert.match(PAGE, /import \{ customRangeFieldInvalid, customRangeState \} from '\.\/manager-record-date-range';/);
  assert.match(page, /const customState = range === 'Custom' \? customRangeState\(dateFrom, dateTo, null, today\) : 'valid';/);
  // Reversed, malformed and future ranges are reported instead of silently accepted.
  assert.match(page, /customState === 'reversed' \? 'From date must be on or before To date\.'/);
  assert.match(page, /aria-invalid=\{customRangeFieldInvalid\(customState, 'from', dateFrom, dateTo, today\)\}/);
  assert.match(page, /aria-invalid=\{customRangeFieldInvalid\(customState, 'to', dateFrom, dateTo, today\)\}/);
  assert.match(page, /\{rangeInvalid && <p id=\{rangeMessageId\} className="sl-mgr-forecast-range-message" role="alert">/);
  // Both ends can never exceed the Philippine business date, so no future date is offered.
  assert.match(page, /const today = businessDateInputValue\(\);/);
  assert.match(page, /const \[range, setRange\] = useState\('This Week'\);/);
  assert.match(page, /const \[trendPeriod, setTrendPeriod\] = useState\('This Week'\);/);
  assert.match(page, /range === 'This Week' \? businessWeekRange\(\)/);
  assert.match(page, /range === 'Last 7 Days' \? businessDayRange\(7\)/);
  assert.match(page, /range === 'Last 30 Days' \? businessDayRange\(30\)/);
  assert.equal((page.match(/max=\{today\}/g) || []).length, 1, 'the To field caps at today');
  // The selected range survives closing and reopening the control, because it is page
  // state and never reset on the range selector's own change handler.
  assert.match(page, /const \[dateFrom, setDateFrom\] = useState\(''\);/);
  assert.match(page, /value=\{range\} options=\{\['This Week','Last 7 Days','Last 30 Days','This Month','Custom'\]\.map\(value => \(\{value, label: value\}\)\)\} onChange=\{value => \{ setRange\(value\); setPage\(1\); \}\}/);
  // Reset restores the default period and clears both dates and both filters.
  assert.match(page, /setRange\('This Week'\); setDateFrom\(''\); setDateTo\(''\); setCategory\(''\); setIngredient\(''\); setSearch\(''\); setPage\(1\);/);
  assert.doesNotMatch(page, new RegExp("setRange\\('This Week'\\); setDateFrom\\(''\\); setDateTo\\(''\\); setCategory\\('All"));
  // The two-field block is laid out in a track wide enough for both dates, and the
  // page-scoped tracks follow this page's real control order rather than Change Requests.
  assert.match(STYLES, /\.sl-mgr-forecast-page \.sl-application-records-toolbar\[data-filter-layout="records-five"\]:has\(\.sl-v219-custom-date-range\) \{\s*grid-template-columns: minmax\(13rem,1\.45fr\)/);
  assert.match(STYLES, /\.sl-mgr-forecast-page \.sl-v219-custom-date-range input\[aria-invalid="true"\] \{ border-color: var\(--sl-critical\); \}/);
  assert.match(STYLES, /@media \(width<=1320px\) \{\s*\.sl-mgr-forecast-page \.sl-application-records-toolbar\[data-filter-layout="records-five"\]:has\(\.sl-v219-custom-date-range\) \{\s*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);/);
});

test('the trend period control is the shared FilterSelect, not a native select', () => {
  const page = forecasting();
  assert.match(page, /const forecastPeriodOptions = \['This Week', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'\]\.map\(value => \(\{ value, label: value \}\)\);/);
  assert.match(page, /<Card id="mgr-forecast-v-actual" title="Forecast vs\. Actual" action=\{<div className="sl-mgr-fc-header-tools"><ForecastVsActualLegend/);
  assert.match(page, /<FilterSelect className="sl-dashboard-filter" ariaLabel="Forecast trend period" value=\{trendPeriod\} options=\{forecastPeriodOptions\} onChange=\{setTrendPeriod\} \/>/);
  // The only surviving native select in the card is the rows-per-page control in the footer.
  const selects = page.match(/<select/g) || [];
  assert.equal(selects.length, 1, 'only the rows-per-page select stays native');
  // Its scoped rule survives late in the cascade; the removed native-select styling does not linger.
  assert.match(STYLES, /\.sl-mgr-forecast-page \.sl-dashboard-filter \.sl-filter-select-trigger \{ min-height: 32px;/);
  assert.doesNotMatch(STYLES, /\.sl-mgr-forecast-page \.sl-dashboard-filter select \{/);
});

test('the corrections fabricate no forecasting value', () => {
  const page = forecasting();
  // Every KPI keeps its truthful pending fallback copy when evaluation data is absent.
  assert.match(page, /<span>Forecast Accuracy<\/span>[\s\S]*?<strong>—<\/strong><small>Forecast data pending<\/small>/);
  assert.match(page, /<span>Total Ingredients Forecasted<\/span><strong>—<\/strong>/);
  assert.match(page, /<span>High Demand \(Next 7 Days\)<\/span><strong>—<\/strong>/);
  assert.match(page, /<span>At-Risk Ingredients<\/span><strong>—<\/strong>/);
  assert.match(page, /<ApplicationPendingState description="Ingredient forecasts will appear when the forecasting service is available\." \/>/);
  // The panels fall back to trendWindow and ForecastInsightsEmpty when no live records exist.
  assert.match(page, /<ForecastVsActualChart ariaLabel="Forecast versus actual ingredient consumption by date" points=\{[^}]*trendWindow\}/);
  // The chart receives the period's dates rather than an empty list, so the reference's
  // axis and gridlines survive an empty period. Each point carries null for both series:
  // no forecast was produced and nothing was recorded, which is not a measured zero.
  assert.match(page, /const trendWindow = emptyForecastWindow\(trendFrom, trendTo\);/);
  assert.match(page, /emptyForecastWindow/);
  // The empty chart names itself through the reference panel's own title slot, and still
  // claims no value. The label is set by the component, not passed in by the page.
  assert.match(page, /emptyDescription="Forecast and actual consumption will appear when validated forecast and usage records are available\."/);
  assert.doesNotMatch(page, /<CategoryDemandEmpty/);
  assert.match(page, /<ForecastInsightsEmpty \/>/);
  // No cell, badge or status hardcodes a fabricated forecast number.
  assert.doesNotMatch(page, /Forecast Accuracy<\/span><strong>\d/);
  assert.doesNotMatch(page, /(predictedDemand|forecastValue|accuracyScore|riskScore)\s*[:=]/);
});

test('the seven forecast columns and their local overflow are preserved', () => {
  const page = forecasting();
  assert.match(page, /<th>Ingredient<\/th><th>Category<\/th><th>Current Stock<\/th><th>Avg\. Daily Usage<\/th><th>Forecasted Demand \(Next 30 Days\)<\/th><th>Recommended Action<\/th><th>Risk Level<\/th>/);
  assert.match(page, /<div className="sl-mgr-forecast-tablewrap sl-application-records-table-shell"><table className="sl-application-records-table sl-data-table">/);
  // The message is a sibling of the scroller, so it centres in the visible width rather
  // than in the 76rem canvas. Inside the scroller a phone would show a blank body, because
  // the canvas centre sits past the right edge of the ~369px scroll port.
  assert.match(page, /<div className="sl-mgr-forecast-table-empty"><ApplicationPendingState description="Ingredient forecasts will appear when the forecasting service is available\." \/><\/div>/);
  assert.doesNotMatch(page, /<td colSpan=\{7\}/);
  assert.match(STYLES, /\.sl-mgr-forecast-page \.sl-mgr-forecast-table-empty \{\s*display: grid;\s*place-items: center;/);
  // The container localizes overflow; the table keeps its real minimum width.
  assert.match(STYLES, /\.sl-mgr-forecast-tablewrap \{\s*min-width: 0;\s*overflow: auto;/);
  assert.match(STYLES, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table \{ min-width: 76rem; \}/);
});

test('search, Reset and pagination still work on the forecast table', () => {
  const page = forecasting();
  assert.match(page, /<input value=\{search\} onChange=\{event => \{ setSearch\(event\.target\.value\); setPage\(1\); \}\} placeholder="Search ingredients\.\.\." \/>/);
  assert.match(page, /setRange\('This Week'\); setDateFrom\(''\); setDateTo\(''\); setCategory\(''\); setIngredient\(''\); setSearch\(''\); setPage\(1\);/);
  assert.match(page, /<Pagination compact page=\{page\} pageSize=\{rows\} total=\{forecastTableData\?\.total \?\? 0\} itemLabel="forecasts" onPageChange=\{setPage\} \/>/);
  // Date Range stays an independent, working local filter with its Custom branch.
  assert.match(page, /<span>Date Range<\/span><FilterSelect ariaLabel="Filter forecasts by date range" value=\{range\}/);
  assert.match(page, /range === 'Custom' && <div className="sl-v219-custom-date-range"/);
});
