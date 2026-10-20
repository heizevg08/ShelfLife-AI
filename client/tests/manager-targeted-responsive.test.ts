import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
const inventory = readFileSync(new URL('../src/components/application/ManagerInventoryPage.tsx', import.meta.url), 'utf8');
const usage = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
const alerts = readFileSync(new URL('../src/app/(administration)/Alerts.tsx', import.meta.url), 'utf8');
const sharedRule = css.indexOf(':is(.sl-application-records,.sl-sa-account-pattern-records) :is(.sl-application-records-table,.sl-sa-ingredients-table) {');

test('Manager Usage and Alerts tables override the shared zero minimum inside their scroll shells', () => {
  assert.match(usage, /sl-manager-usage-records sl-application-records[\s\S]*?sl-application-records-table-shell sl-sa-ingredients-table-scroll"><table className="sl-application-records-table/);
  assert.match(usage, /\['Activity Date','Ingredient','Type','Quantity','Batch ID','Details \/ Reason','Recorded By'\]/);
  assert.match(alerts, /sl-manager-alerts-records-card sl-application-records[\s\S]*?sl-manager-alerts-table-wrap sl-application-records-table-shell sl-sa-ingredients-table-scroll/);
  assert.match(alerts, /<th>Alert Date<\/th>[\s\S]*?<th>Status<\/th>/);
  for (const rule of [
    '.sl-manager-usage-live .sl-manager-usage-records .sl-application-records-table { min-width: 54rem; }',
    '.sl-manager-alerts-v134 .sl-manager-alerts-records-card .sl-application-records-table { min-width: 44rem; }',
  ]) {
    assert.ok(css.indexOf(rule) > sharedRule, `${rule} must win the shared zero minimum`);
  }
  assert.match(css, /:is\(\.sl-manager-dashboard-v116,[^\n]+\) :is\(\.sl-dashboard-reference-table,[^\n]+\) \{\s*max-width: 100%;\s*min-width: 0;\s*overflow-x: auto;/);
  assert.match(alerts, /<td colSpan=\{6\} className="sl-empty-cell">\{[\s\S]*?<DataState kind="empty" title="No matching alerts"/);
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.sl-manager-alerts-v134 \.sl-manager-alerts-table-wrap \.sl-manager-alerts-pending \{\s*width: min\(100%, calc\(100vw - 4rem\)\);\s*margin-inline: 0;/);
});

test('FEFO uses one five-column model and Inventory Category reuses the Stock Status card', () => {
  assert.match(inventory, /sl-manager-inventory-table-shell"><table className="[^"]*sl-manager-fefo-table"><colgroup><col\/><col\/><col\/><col\/><col\/><\/colgroup>/);
  assert.match(inventory, /\['Ingredient','Batch ID','Expiration Date','Days Left','Priority'\]\.map\(value => <th key=\{value\} scope="col">/);
  assert.match(inventory, /listInventoryBatches\(\{ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true \}, controller\.signal\)/);
  assert.doesNotMatch(inventory, /filter\(batch => batch\.daysLeft >= 0\)\.sort\(\(a, b\) => a\.daysLeft - b\.daysLeft\)/);
  assert.match(inventory, /fefo\.map\(batch => \{ const urgency = fefoUrgency\(batch\.expirationDate, fefoReference\)/);
  assert.match(inventory, /<td>\{urgency \? <Status tone=\{urgency\.tone\}>\{urgency\.label\}<\/Status> : '—'\}<\/td>/);
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-fefo-table td:last-child \.sl-status \{ gap: \.25rem; padding-inline: \.4rem; \}/);
  assert.match(inventory, /fefoFailed \? 'error' : fefo === null \? 'loading' : 'empty'/);
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-inventory-table-shell \.sl-manager-fefo-table \{ min-width: 36rem; table-layout: fixed; \}/);
  assert.deepEqual([...css.matchAll(/\.sl-manager-fefo-table col:nth-child\((\d)\) \{ width: (\d+)%; \}/g)].map(([, column, width]) => [Number(column), Number(width)]), [[1,26],[2,19],[3,25],[4,16],[5,14]]);
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-fefo-table :is\(th,td\) \{ padding: \.6rem \.7rem!important; text-align: left!important; \}/);
  // Source guard only; browser measurements verify rendered text positions.
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-fefo-table :is\(th,td\):is\(:nth-child\(2\),:nth-child\(3\)\):not\(\.sl-empty-cell\) \{ text-align: center!important; \}/);
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-fefo-table :is\(th,td\):nth-child\(2\) \{ padding-inline: \.125rem!important; \}/);
  assert.match(inventory, /<Card id="manager-inventory-category" title="Inventory by Category">/);
  assert.match(inventory, /items=\{summary\.categoryCounts \?\? \[\]\}/);
  assert.match(css, /\.sl-manager-inventory-live \.sl-manager-inventory-lower-grid > \.sl-card \.sl-card-body \{ flex: 1; display: flex; \}/);
});
