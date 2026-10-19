import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/application.css');
const dashboard = read('../src/components/dashboard/SuperAdminDashboard.tsx');
const auditTable = read('../src/components/application/AuditTable.tsx');
const accounts = read('../src/components/application/AccountsTable.tsx');
const security = read('../src/app/(administration)/SecurityActivity.tsx');
const profile = read('../src/app/(administration)/SuperAdminProfile.tsx');

test('Super Admin surfaces share the approved application-wide palette, not a role-owned one', () => {
  // Super Admin must inherit the approved shared tokens. It must NOT define a competing
  // role palette: no --sl-sa colour tokens and no remap of the shared --sl-* tokens.
  const saBlock = css.match(/\.sl-shell\[data-role="Super Admin"\] \{([\s\S]*?)\}/)?.[1] ?? '';
  assert.doesNotMatch(saBlock, /--sl-(sa-)?(brand|canvas|surface|text|muted|border|focus|on-brand)[:\s]/, 'Super Admin defines no colour tokens of its own');
  assert.match(saBlock, /--sl-layer-header:20;/, 'Super Admin still owns only its overlay stacking order');
  assert.match(dashboard, /sl-superadmin-surface/);
  assert.match(security, /sl-superadmin-surface/);
  assert.match(profile, /sl-superadmin-surface sl-superadmin-profile/);
  assert.doesNotMatch(dashboard, /sl-sa-kpi sl-inventory-staff-kpi/);
  // Requirement change (audit-log remediation): Security & Activity now renders four
  // audit KPI cards through the shared Admin account card contract. Reusing the shared
  // class is the opposite of a role-owned variant, so the page must match it — and must
  // still own no KPI class of its own.
  assert.match(security, /sl-sa-kpi sl-inventory-staff-kpi/);
  assert.doesNotMatch(security, /sl-sa-kpi sl-superadmin-kpi/, 'Security & Activity owns no KPI card variant');
  assert.match(accounts, /sl-sa-kpi sl-inventory-staff-kpi/);
});

test('Super Admin tables retain horizontal scroll ownership on narrow screens', () => {
  assert.match(accounts, /sl-table-scroll sl-superadmin-table-scroll/);
  assert.match(css, /\.sl-superadmin-table-scroll \{[\s\S]*?overflow-x:auto!important;/);
  assert.match(css, /\.sl-superadmin-users-page-v64 \.sl-superadmin-table \{ min-width:68rem!important; \}/);
});

test('Super Admin breakpoints and overlay layers are explicit', () => {
  assert.match(css, /--sl-layer-header:20;[\s\S]*?--sl-layer-dropdown:60;[\s\S]*?--sl-layer-dialog:90;/);
  assert.match(css, /@container \(width<=68\.75rem\)[\s\S]*?\.sl-superadmin-surface \.sl-sa-analytics-row \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(css, /@container \(width<=43\.75rem\)[\s\S]*?\.sl-superadmin-surface \.sl-superadmin-kpis \{ grid-template-columns:minmax\(0,1fr\); \}/);
});

test('Super Admin dashboard Details removes redundant trailing successfully without changing audit data', () => {
  assert.match(auditTable, /const dashboardAuditDetails = \(row: AuditRecord\) =>\s*\(row\.detailsDisplay \?\? auditDetails\(row\)\)\.replace\(\/\\s\+successfully\(\?=\\\.\?\$\)\/i, ''\)/);
  assert.match(auditTable, /dashboardDetails && <td>\{dashboardAuditDetails\(row\)\}<\/td>/);
  assert.match(auditTable, /row\.detailsDisplay \?\? auditDetails\(row\)/, 'authoritative formatted text remains the source');
});

test('Super Admin analytics and activity reuse the compact shared dashboard conventions', () => {
  assert.doesNotMatch(dashboard, /sl-sa-role-dot/, 'owner-approved dashboard omits role dots');
  assert.match(css, /\.sl-superadmin-dashboard \.sl-sa-analytics-row-v317 > \.sl-card \{[\s\S]*?min-height:0;[\s\S]*?height:auto;/);
  assert.match(css, /\.sl-superadmin-dashboard \.sl-sa-analytics-row-v317 \.sl-card-header \{[\s\S]*?padding:var\(--sl-space-5\) var\(--sl-space-6\)/);
  assert.match(css, /\.sl-superadmin-dashboard \.sl-sa-progress-track \{[\s\S]*?height:\.625rem/);
  assert.match(css, /\.sl-superadmin-dashboard #sl-sa-recent-activity table\[data-layout="admin-dashboard-audit"\] :is\(th,td\) \{[\s\S]*?padding:\.65rem \.875rem/);
});
