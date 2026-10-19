import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Manager Forecasting UI correction pass (2026-10-13).
//
// The page renders model output only when the ingredient-scoped API returns it. The
// unavailable state stays explicit so missing history cannot look like zero demand.

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

test('the category and ingredient filters draw on real master data before requesting one forecast', () => {
  const page = forecasting();
  // Both controls are populated from the Manager's authorized ingredient master data
  // (/ingredients/categories and /ingredients/stock-in-options), the same services the
  // approved Manager /Inventory and /UsageWaste pages already use. A selected ingredient
  // then drives one forecast request; the UI never bulk-requests every ingredient.
  assert.match(page, /Promise\.all\(\[listIngredientCategories\(controller\.signal\), listStockInIngredients\(controller\.signal\)\]\)/);
  assert.match(page, /const categoryOptions = useMemo\(\(\) => \[\{ value: '', label: 'All Categories' \}, \.\.\.\(categories \?\? \[\]\)\.map/);
  assert.match(page, /const visibleIngredients = useMemo\(\(\) => \(ingredients \?\? \[\]\)\.filter/);
  assert.match(page, /label: 'Choose an ingredient'/);
  // The Ingredient control follows the chosen category and clears a now-stale choice.
  assert.match(page, /onChange=\{value => \{ setCategory\(value\); setIngredient\(''\); \}\}/);
  // A control with nothing real to offer still renders disabled rather than pretending
  // to filter, and each unavailable reason is reported on its own title.
  assert.match(page, /disabled=\{categoriesUnavailable\} title=\{categoriesUnavailable \? categoryHint : 'Filter by ingredient category'\}/);
  assert.match(page, /disabled=\{ingredientsUnavailable\} title=\{ingredientHint\}/);
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

test('the forecast horizon uses future Philippine calendar dates and a bounded live request', () => {
  const page = forecasting();
  assert.match(page, /const today = businessDateInputValue\(\);/);
  assert.match(page, /shiftBusinessDate\(today, index \+ 1\)/);
  assert.match(page, /\[7, 14, 30\]\.map\(value => \(\{ value: String\(value\), label: `Next \$\{value\} days` \}\)\)/);
  assert.match(page, /forecastIngredient\(ingredient, forecastDates, controller\.signal\)/);
  assert.match(page, /setRefreshToken\(value => value \+ 1\)/);
});

test('the forecast horizon control is the shared FilterSelect, not a native select', () => {
  const page = forecasting();
  assert.match(page, /ariaLabel="Forecast horizon" value=\{String\(horizon\)\}/);
  assert.match(page, /title="Projected demand"/);
  const selects = page.match(/<select/g) || [];
  assert.equal(selects.length, 0, 'the forecast page delegates selection controls to FilterSelect');
});

test('the page renders only forecast values returned by the live API and names unavailable history', () => {
  const page = forecasting();
  assert.match(page, /const predictions = forecast\.state === 'ready'/);
  assert.match(page, /prediction\.predictedConsumption/);
  assert.match(page, /At least 14 consecutive daily usage records are required/);
  assert.match(page, /The forecasting runtime is unavailable on this server\./);
  assert.doesNotMatch(page, /forecast-sample-data|FORECAST_SAMPLE/);
});

test('the live forecast table keeps local overflow and shows returned prediction rows', () => {
  const page = forecasting();
  assert.match(page, /<th>Date<\/th><th>Ingredient<\/th><th>Category<\/th><th>Projected demand<\/th><th>Unit<\/th>/);
  assert.match(page, /<div className="sl-mgr-forecast-tablewrap sl-application-records-table-shell"><table className="sl-application-records-table sl-data-table">/);
  assert.match(page, /<td colSpan=\{5\}><ApplicationPendingState/);
  assert.match(page, /prediction\.predictedConsumption\.toFixed\(3\)/);
  assert.match(STYLES, /\.sl-mgr-forecast-tablewrap \{\s*min-width: 0;\s*overflow: auto;/);
});

test('search, category, selected ingredient, horizon, and refresh drive the live forecast', () => {
  const page = forecasting();
  assert.match(page, /<input value=\{search\} onChange=\{event => setSearch\(event\.target\.value\)\} placeholder="Search ingredients\.\.\." \/>/);
  assert.match(page, /ariaLabel="Choose an ingredient to forecast"/);
  assert.match(page, /ariaLabel="Forecast horizon"/);
  assert.match(page, /Refresh forecast/);
});
