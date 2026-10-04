import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const moduleSource = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
const requestsSource = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

const section = (start: string, end: string) => moduleSource.slice(moduleSource.indexOf(start), moduleSource.indexOf(end));

test('Inventory Staff qualifying record filters use the shared FilterSelect', () => {
  const waste = section('function InventoryStaffWastePage', 'function ManagerUsageWastePage');
  const usage = section('function InventoryStaffUsagePage', 'const inventoryBatchStatusTone');
  const stockIn = section('function InventoryStaffStockInPage', 'function InventoryStaffInventoryBatchesPage');
  const inventory = section('function InventoryStaffInventoryBatchesPage', 'function ManagerInventoryPage');

  for (const label of ['Filter by waste reason', 'Filter waste by date range']) assert.ok(waste.includes(`ariaLabel="${label}"`), label);
  for (const label of ['Filter by ingredient', 'Filter by date range']) assert.ok(usage.includes(`ariaLabel="${label}"`), label);
  for (const label of ['Ingredient', 'Filter Stock-In by date range']) assert.ok(stockIn.includes(`ariaLabel="${label}"`), label);
  for (const label of ['Filter inventory batches by category', 'Filter inventory batches by status', 'Sort inventory batches']) assert.ok(inventory.includes(`ariaLabel="${label}"`), label);

  assert.doesNotMatch(waste.slice(waste.indexOf('sl-staff-waste-toolbar'), waste.indexOf('</div></div>', waste.indexOf('sl-staff-waste-toolbar'))), /<select/);
  assert.doesNotMatch(usage.slice(usage.indexOf('sl-staff-usage-toolbar'), usage.indexOf('</div></div>', usage.indexOf('sl-staff-usage-toolbar'))), /<select/);
  assert.doesNotMatch(stockIn.slice(stockIn.indexOf('sl-staff-stockin-history-filters'), stockIn.indexOf('</div></div>', stockIn.indexOf('sl-staff-stockin-history-filters'))), /<select/);
  assert.match(moduleSource, /Rows per page<\/span><select/);
});

test('Inventory Staff Custom Range structures remain outside FilterSelect', () => {
  assert.match(moduleSource, /range==='Custom range'&&<div className="sl-v219-custom-date-range" aria-label="Custom waste date range">/);
  assert.match(moduleSource, /range === 'Custom range' && <div className="sl-v219-custom-date-range" aria-label="Custom usage date range">/);
  assert.match(moduleSource, /stockDateRange==='Custom range'&&<div className="sl-v219-custom-date-range" aria-label="Custom stock-in date range">/);
  assert.match(requestsSource, /range==='Custom range'&&<div className="sl-v219-custom-date-range"><label><span>From<\/span><input type="date"[\s\S]*?<label><span>To<\/span><input type="date"/);
});

test('My Requests migrates only toolbar filters and keeps form and pagination selects native', () => {
  for (const label of ['Filter requests by type', 'Filter requests by status', 'Filter requests by date range']) assert.ok(requestsSource.includes(`ariaLabel="${label}"`), label);
  const toolbar = requestsSource.slice(requestsSource.indexOf('sl-staff-my-requests-toolbar'), requestsSource.indexOf('</div></div>', requestsSource.indexOf('sl-staff-my-requests-toolbar')));
  assert.doesNotMatch(toolbar, /<select/);
  assert.match(requestsSource, /Rows per page <select/);
  assert.match(requestsSource, /<span>Request Type<\/span><select/);
});

test('shared menu reserves no gutter for short lists and scrolls bounded long lists', () => {
  assert.match(styles, /\.sl-filter-select-menu \{[^}]*--sl-filter-select-overlay-layer:60;[^}]*position:fixed;[^}]*z-index:var\(--sl-filter-select-overlay-layer\);[^}]*max-width:calc\(100vw - 1rem\);[^}]*max-height:17rem;[^}]*opacity:1;[^}]*overflow-y:auto; overflow-x:hidden;[^}]*scrollbar-gutter:auto;/);
  assert.doesNotMatch(styles, /\.sl-filter-select-menu \{[^}]*scrollbar-gutter:stable/);
  assert.doesNotMatch(styles, /\.sl-filter-select-menu \{[^}]*overflow-y:scroll/);
  assert.match(styles, /background-color:var\(--sl-surface,#fff\);/);
  assert.match(styles, /\.sl-filter-select-option \{[^}]*padding:\.425rem \.625rem;[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/);
  assert.match(styles, /\.sl-filter-select-option\[aria-selected=true\] \{ font-weight:600; \}/);
  assert.doesNotMatch(styles, /\.sl-filter-select-option\[aria-selected=true\][^}]*?(?:box-shadow|background|border|outline|color:var\(--sl-brand\))/);
  assert.doesNotMatch(styles, /\.sl-staff-inventory-v149 \.sl-staff-inventory-record-filters select/);
});
