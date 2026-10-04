import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const filterSelect = read('../src/components/application/FilterSelect.tsx');
const modulePage = read('../src/components/application/ModulePage.tsx');
const requests = read('../src/app/(administration)/ChangeRequests.tsx');
const dashboard = read('../src/components/dashboard/RoleDashboard.tsx');
const primitives = read('../src/components/application/primitives.tsx');
const styles = read('../src/styles/application.css');
const recorder = read('../src/utils/inventory-batch-recorder.ts');

test('locked FilterSelect behavior and portal contract remain shared', () => {
  assert.match(filterSelect, /createPortal\(/);
  assert.match(filterSelect, /closest<HTMLElement>\('\.sl-app'\) \?\? document\.body/);
  assert.match(filterSelect, /getBoundingClientRect\(\)/);
  assert.match(filterSelect, /window\.addEventListener\('resize', updatePosition\)/);
  assert.match(filterSelect, /window\.addEventListener\('scroll', updatePosition, true\)/);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']) assert.ok(filterSelect.includes(`'${key}'`), key);
  assert.match(filterSelect, /aria-activedescendant=/);
  assert.match(filterSelect, /aria-selected=/);
  assert.match(styles, /\.sl-filter-select-menu \{[^}]*max-height:17rem;[^}]*overflow-y:auto; overflow-x:hidden;[^}]*scrollbar-gutter:auto;/);
  assert.doesNotMatch(styles, /\.sl-filter-select-menu \{[^}]*scrollbar-gutter:stable/);
  assert.doesNotMatch(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-workspace,\.sl-main\)[^}]*container-type/);
  assert.doesNotMatch(styles, /\.sl-shell\[data-role="Inventory Staff"\] :is\(\.sl-workspace,\.sl-main\)[^}]*overflow-x:clip/);
});

test('all approved Inventory Staff record integrations keep FilterSelect while native form and page-size selects remain excluded', () => {
  for (const label of [
    'Ingredient', 'Filter Stock-In by date range', 'Filter by ingredient', 'Filter by date range',
    'Filter by waste reason', 'Filter waste by date range', 'Filter inventory batches by category',
    'Filter inventory batches by status', 'Sort inventory batches',
  ]) assert.ok(modulePage.includes(`ariaLabel="${label}"`), label);
  for (const label of ['Filter requests by type', 'Filter requests by status', 'Filter requests by date range']) {
    assert.ok(requests.includes(`ariaLabel="${label}"`), label);
  }
  assert.match(modulePage, /Rows per page<\/span><select|Rows per page<\/span>\s*<select/);
  assert.match(requests, /Rows per page <select/);
  assert.match(requests, /<span>Request Type<\/span><select/);
});

test('recorder provenance displays authoritative resolved names and truthful fallback only', () => {
  assert.match(recorder, /const firstName = createdBy\.firstName\?\.trim\(\) \?\? ''/);
  assert.match(recorder, /const lastName = createdBy\.lastName\?\.trim\(\) \?\? ''/);
  assert.match(recorder, /return firstName && lastName \? `\$\{firstName\} \$\{lastName\}` : '—'/);
  assert.doesNotMatch(recorder, /createdBy\.name|Development InventoryStaff/);
  assert.match(modulePage, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.doesNotMatch(modulePage, /currentUser[^\n]*createdBy|createdBy[^\n]*currentUser/);
});

test('shared DataState, Pagination, and Status primitives remain the records baseline', () => {
  assert.match(primitives, /export function DataState\(/);
  assert.match(primitives, /export function Pagination\(/);
  assert.match(primitives, /export function Status\(/);
  for (const source of [modulePage, requests, dashboard]) {
    assert.match(source, /<DataState/);
    assert.match(source, /<Status/);
  }
  assert.match(modulePage, /<Pagination compact/);
  assert.match(requests, /<Pagination compact/);
  assert.match(styles, /\.sl-status \{[\s\S]*?font: var\(--sl-font-label\);/);
});

test('My Requests retains Reset behavior, adaptive Custom Range, details semantics, and pagination', () => {
  assert.match(requests, /const reset=\(\)=>\{setSearch\(''\);setType\(''\);setStatus\(''\);setRange\('All dates'\);setFrom\(''\);setTo\(''\);setPage\(1\)\}/);
  assert.match(requests, />Reset<\/button>/);
  assert.match(requests, /range==='Custom range'&&<div className="sl-v219-custom-date-range">/);
  assert.match(requests, /<ChangeRequestDetailsDialog inventoryStaff inventoryStaffMyRequests request=\{detail\}/);
  assert.match(requests, /<Pagination compact page=\{page\} pageSize=\{rows\} total=\{total\}/);
  assert.match(styles, /\.sl-staff-my-requests-toolbar \{[\s\S]*?flex-wrap:wrap;[\s\S]*?display:flex;/);
});

test('locked interactions and truthful states remain data-driven', () => {
  assert.match(modulePage, /className="sl-detail-enabled-row"[\s\S]*?setViewBatch\(batch\)/);
  assert.match(modulePage, /<DataState kind="loading" title="Loading Stock-In records"/);
  assert.match(modulePage, /<DataState kind="error" title="Stock-In records unavailable"/);
  assert.match(modulePage, /<DataState kind="empty" title=\{stockSummary\?\.totalBatches\?'No matching records':'No live records yet'\}/);
  assert.match(dashboard, /pendingRequestsFailed \? stateRow\(4, 'error'/);
  assert.match(dashboard, /pendingRequests === null \? stateRow\(4, 'loading'/);
  assert.match(dashboard, /stateRow\(4, 'empty', 'No pending requests'/);
  assert.doesNotMatch(dashboard, /mock|fake|placeholder request/i);
});
