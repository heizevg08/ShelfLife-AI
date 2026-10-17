import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const audit = read('components/application/AuditTable.tsx');
const manager = read('components/application/ManagerChangeRequestsPage.tsx');
const dateRange = read('components/application/DateRangeFilter.tsx');
const styles = read('styles/application.css');

test('Admin Audit uses the locked Manager records date-range structure and options', () => {
  assert.match(manager, /\['Last 7 Days','Last 30 Days','Last 90 Days','Custom'\]/);
  assert.match(dateRange, /MANAGER_DATE_RANGE_OPTIONS = DATE_RANGE_OPTIONS\.filter\(option => option\.value !== 'any'\)/);
  assert.match(audit, /<span>Date Range<\/span><FilterSelect ariaLabel="Filter audit records by date range" value=\{periodFilter\} options=\{MANAGER_DATE_RANGE_OPTIONS/);
  assert.match(audit, /periodFilter === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom audit date range">/);
  assert.doesNotMatch(audit, /sl-admin-audit-date-range/);
});

test('Admin Audit reset and custom dates preserve its existing server filter contract', () => {
  assert.match(audit, /useState<DateRangeValue>\('month'\)/);
  assert.match(audit, /setPeriodFilter\('month'\);[\s\S]*?setSpecificFrom\(''\);[\s\S]*?setSpecificTo\(''\)/);
  assert.match(audit, /from: specificStart \?\? \(cutoffDays \? new Date\(Date\.now\(\) - cutoffDays \* 86400000\)\.toISOString\(\) : undefined\)/);
  assert.match(audit, /to: specificEnd/);
  assert.match(audit, /max=\{specificTo \|\| undefined\}/);
  assert.match(audit, /min=\{specificFrom \|\| undefined\}/);
});

test('Admin Audit owns a track-per-control toolbar layout instead of the generic four-track rule', () => {
  // The audit toolbar scopes its layout to its own data-layout token. The
  // generic four-track records-four rule is gone, so the strip can no longer
  // fall back to a four-track grid that wraps its five (or six, with Custom)
  // controls onto an implicit second row.
  assert.match(audit, /className="sl-application-records-toolbar sl-audit-filter-strip" data-layout="audit" data-custom=\{periodFilter === 'custom'\}/);
  assert.doesNotMatch(audit, /data-filter-layout="records-four"/);
  assert.doesNotMatch(styles, /\.sl-application-records-toolbar\[data-filter-layout="records-four"\]/);
  assert.match(styles, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] \{[\s\S]*?grid-template-columns:minmax\(10rem,1\.35fr\) repeat\(3,minmax\(7rem,\.68fr\)\) auto;/);
  assert.match(styles, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\]\[data-custom="true"\][\s\S]*?grid-template-columns:minmax\(9\.5rem,1fr\)/);
  assert.match(styles, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] > \.sl-application-records-filter-actions \{[\s\S]*?grid-column:auto;[\s\S]*?justify-self:end;[\s\S]*?width:max-content;/);
  assert.doesNotMatch(styles, /\.sl-admin-audit-records[\s\S]{0,300}display:contents/);
});

test('Admin Audit keeps a two-column tablet pairing with no detached action row', () => {
  // Search always keeps the full first row. In standard mode the actions pair
  // with Status; in Custom mode the date group pairs with Date Range and the
  // actions keep a full final row, so neither mode leaves a half-empty cell.
  assert.match(styles, /@container \(width<=64rem\)[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] > \.sl-application-records-search \{[\s\S]*?grid-column:1 \/ -1;/);
  assert.match(styles, /\.sl-shell \.sl-admin-view \.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] > \.sl-application-records-filter-actions \{\s*grid-column:auto;/);
  assert.match(styles, /\.sl-shell \.sl-admin-view \.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\]\[data-custom="true"\] > \.sl-application-records-filter-actions \{\s*grid-column:1 \/ -1;/);
  assert.match(styles, /@container \(width<=36rem\)[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
});

test('Admin Audit omits the Action selector without removing it from the shared audit view', () => {
  assert.equal((audit.match(/ariaLabel="Filter audit records by action"/g) ?? []).length, 1);
  assert.doesNotMatch(audit, /adminOverview[\s\S]*?<span>Action<\/span>[\s\S]*?sl-application-records-filter-actions/);
});
