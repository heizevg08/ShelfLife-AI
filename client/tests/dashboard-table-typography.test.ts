import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Inventory Staff lower grid gives Pending Requests desktop room and stacks responsively', () => {
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
  const primitives = readFileSync(new URL('../src/components/application/primitives.tsx', import.meta.url), 'utf8');
  const requestService = readFileSync(new URL('../src/services/change-requests.ts', import.meta.url), 'utf8');
  const rulesStart = styles.lastIndexOf('/* Inventory Staff Dashboard: My Pending Requests owns this compact table geometry. */');
  const effectiveRules = styles.slice(rulesStart);
  const cardSource = primitives.slice(primitives.indexOf('export function Card('));

  assert.match(dashboard, /sl-dashboard-source-table-shell sl-inventory-staff-fefo-table[\s\S]*?table className="sl-data-table sl-dashboard-source-table"/);
  assert.match(dashboard, /sl-inventory-staff-dashboard-table sl-dashboard-source-table-shell[\s\S]*?table className="sl-data-table sl-dashboard-source-table sl-change-request-preview-table sl-inventory-staff-pending-requests-table"/);
  assert.match(dashboard, /<colgroup><col className="sl-pending-request-id-column" \/><col className="sl-pending-request-change-column" \/><col className="sl-pending-request-date-column" \/><col className="sl-pending-request-status-column" \/><\/colgroup>/);
  assert.match(cardSource, /<section className="sl-card" aria-labelledby=\{id\}>/);
  assert.doesNotMatch(cardSource, /<section[^>]*\bid=\{id\}/);

  assert.match(styles, /\.sl-inventory-staff-dashboard-v140 \.sl-inventory-staff-preview-grid \{\s*grid-template-columns:minmax\(0,3fr\) minmax\(0,2fr\);/);
  assert.match(styles, /@media \(width<=1100px\) \{\s*\.sl-inventory-staff-dashboard-v140 \.sl-inventory-staff-preview-grid \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.doesNotMatch(styles, /\.sl-inventory-staff-preview-grid \{\s*grid-template-columns:minmax\(0,1\.72fr\) minmax\(0,1fr\);/);
  assert.match(effectiveRules, /\.sl-inventory-staff-dashboard-v140 \.sl-inventory-staff-pending-requests-table \{\s*min-width:0;\s*table-layout:fixed;/);
  assert.match(effectiveRules, /\.sl-pending-request-id-column \{ width:28%; \}[\s\S]*?\.sl-pending-request-change-column \{ width:39%; \}[\s\S]*?\.sl-pending-request-date-column \{ width:19%; \}[\s\S]*?\.sl-pending-request-status-column \{ width:14%; \}/);
  assert.ok((2 / 5) * 0.39 > (1 / 2.72) * 0.41, 'Requested Change gains physical parent-row width');
  assert.ok((2 / 5) * 0.19 > (1 / 2.72) * 0.17, 'Submitted On gains physical parent-row width');
  assert.ok((2 / 5) * 0.14 > (1 / 2.72) * 0.13, 'Status gains physical parent-row width');
  assert.match(effectiveRules, /\.sl-inventory-staff-pending-requests-table :is\(th,td\) \{\s*padding-inline:\.55rem;/);
  assert.match(effectiveRules, /@media \(width>=769px\)[\s\S]*?\.sl-inventory-staff-pending-requests-table thead th \{\s*font:550 \.8125rem\/1\.4 "Inter",sans-serif;[\s\S]*?\.sl-inventory-staff-pending-requests-table tbody td:not\(\.sl-empty-cell\) \{\s*font:400 1rem\/1\.5 "Inter",sans-serif;/);
  assert.match(effectiveRules, /\.sl-inventory-staff-pending-requests-table tbody td:not\(\.sl-empty-cell\) \{[\s\S]*?padding-block:\.7rem;\s*vertical-align:middle;/);
  assert.match(effectiveRules, /\.sl-inventory-staff-pending-requests-table :is\(th,td\):is\(:nth-child\(2\),:nth-child\(3\)\) \{\s*white-space:nowrap;/);
  assert.match(effectiveRules, /@media \(width<=620px\)[\s\S]*?\.sl-inventory-staff-pending-requests-table \{\s*min-width:34rem;\s*table-layout:auto;[\s\S]*?:is\(col,th,td\) \{\s*width:auto;[\s\S]*?:is\(th,td\):is\(:nth-child\(2\),:nth-child\(3\)\) \{\s*white-space:normal;/);
  assert.match(dashboard, /<td><button type="button" className="sl-record-identifier-link sl-emphasized-value"[\s\S]*?\{request\.requestID\}<\/button><\/td>/);
  assert.match(dashboard, /<td>\{changeRequestTypeLabel\(request\.requestType\)\}<\/td><td>\{formatDate\(request\.createdAt\)\}<\/td><td><Status/);
  assert.match(requestService, /MINIMUM_STOCK_CHANGE:'Minimum Stock Change'/);
  assert.match(requestService, /STANDARD_UNIT_COST_CHANGE:'Standard Unit Cost Change'/);
  assert.match(dashboard, /<Status tone=\{requestStatusTone\(request\)\}>\{requestStatus\(request\)\}<\/Status>/);
  assert.ok(rulesStart > styles.lastIndexOf('.sl-dashboard-source-table td'));
  assert.ok(rulesStart > styles.lastIndexOf('.sl-reference-records-table td'));
  assert.doesNotMatch(effectiveRules, /sl-inventory-staff-fefo-table|sl-reference-records-table|sl-staff-|sl-manager-|sl-admin-|sl-superadmin-/);
  assert.doesNotMatch(styles, /\.sl-inventory-staff-preview-grid \.sl-inventory-staff-bottom \.sl-inventory-staff-dashboard-table \.sl-dashboard-source-table \{[^}]*table-layout/);
  assert.doesNotMatch(styles, /\.sl-inventory-staff-dashboard-table :is\(th,td\):nth-child/);
  assert.doesNotMatch(styles, /#inventory-staff-my-pending-requests|\.sl-inventory-staff-preview-grid \.sl-dashboard-source-table \.sl-record-identifier-link/);
  assert.match(styles, /\.sl-record-identifier-link \{[\s\S]*?font:inherit;[\s\S]*?font-weight:500;/);
  assert.match(styles, /\.sl-emphasized-value \{ font-weight: 600!important; \}/);
  assert.match(styles, /\.sl-status \{[\s\S]*?font: var\(--sl-font-label\);/);
});
