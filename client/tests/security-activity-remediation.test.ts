import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Regression contracts for the Super Admin /SecurityActivity remediation.
// These pin the decisions the audit log records: four backend-derived KPI cards,
// one suppressed status dot, immutable-name handling, concise Details wording,
// the shared Custom Date Range, and the audit query/export behaviour.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const security = read('../src/app/(administration)/SecurityActivity.tsx');
const auditTable = read('../src/components/application/AuditTable.tsx');
const accounts = read('../src/components/application/AccountsTable.tsx');
const primitives = read('../src/components/application/primitives.tsx');
const css = read('../src/styles/application.css');
const accountValidator = read('../../server/src/validators/administration.ts');
const profileUpdate = read('../../server/src/services/profile-update.ts');
const auditModel = read('../../server/src/models/audit-record.ts');
const presentation = read('../../server/src/services/audit-presentation.ts');
const administrationService = read('../../server/src/services/administration.ts');
const auditWorkbook = read('../../server/src/services/audit-workbook.ts');
const auditStore = read('../../server/src/services/administration-store.ts');
const authRoutes = read('../../server/src/routes/auth.routes.ts');
const administrationRoutes = read('../../server/src/routes/administration.routes.ts');

test('Security & Activity renders exactly four KPI cards from server-side counts', () => {
  // Each card reads the `total` of a one-row query, so every figure is counted by the
  // authorized backend rather than derived from whichever rows are currently loaded.
  assert.match(security, /listAuditRecords\(1, 1, 'desc', filters, signal\)\.then\(page => page\.total\)/);
  // Documented windows: no filter (all retained), rolling 30 days, and the two supported
  // outcome values of the Success | Failed | Warning status model.
  assert.match(security, /const AUDIT_WINDOW_MS = 30 \* 86400000;/);
  assert.match(security, /auditCount\(\{\}, abort\.signal\)/, 'total uses no window or filter');
  assert.match(security, /auditCount\(\{ from \}, abort\.signal\)/, 'recent uses the 30-day window');
  assert.match(security, /auditCount\(\{ status: 'Success' \}, abort\.signal\)/);
  assert.match(security, /auditCount\(\{ status: 'Failed' \}, abort\.signal\)/);

  const cards = security.slice(security.indexOf('const cards = ['), security.indexOf('] as const;', security.indexOf('const cards = [')));
  const labels = [...cards.matchAll(/label: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(labels, ['Total Audit Events', 'Events (Last 30 Days)', 'Successful Events', 'Failed Events']);
  // No placeholder category and no literal number: every value is a fetched count.
  for (const value of ['kpis?.total', 'kpis?.recent', 'kpis?.successful', 'kpis?.failed']) {
    assert.ok(cards.includes(value), `${value} is a fetched count`);
  }
  assert.doesNotMatch(cards, /value: \d/, 'no KPI is hardcoded');
});

test('Security & Activity reuses the shared Admin KPI card contract and drops the account card', () => {
  assert.match(security, /sl-sa-kpis sl-inventory-staff-kpis sl-admin-user-kpis sl-dashboard-kpis sl-superadmin-kpis sl-user-management-kpis/);
  assert.match(security, /className="sl-sa-kpi sl-inventory-staff-kpi"/, 'shared card with border accents and icon treatment');
  assert.doesNotMatch(security, /sl-sa-kpi sl-superadmin-kpi/, 'no role-owned KPI card variant');
  // The retired Total Users card no longer pulls the dashboard summary.
  assert.doesNotMatch(security, /dashboardSummary/);
  // The page owns the truthful strip, so the shared table must not render a second one.
  assert.match(security, /showSummary=\{false\}/);
  // Same cadence as the shared table's poll, so the cards cannot drift from the rows.
  assert.match(security, /const KPI_REFRESH_MS = 15000;/);
  // The old two-card grid override is gone, so the shared 4 -> 2 -> 2 -> 1 rules apply.
  assert.doesNotMatch(css, /\.sl-security-activity-v78 \.sl-superadmin-kpis/);
  assert.match(css, /\.sl-superadmin-surface \.sl-user-management-kpis \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); \}/);
});

test('the Audit Logs status dot is suppressed for this page only', () => {
  assert.match(css, /\.sl-security-activity-v78 \.sl-application-records-table\[data-layout="audit"\] \.sl-status-dot \{ display:none; \}/);
  assert.match(css, /\.sl-security-activity-v78 \.sl-application-records-table\[data-layout="audit"\] \.sl-status \{ gap:0; \}/);
  // Badge colour and text still carry the outcome, and the shared primitive is untouched.
  assert.match(auditTable, /<Status tone=\{rowStatus\(row\) === 'Success' \? 'success' : rowStatus\(row\) === 'Warning' \? 'attention' : 'critical'\}>\{rowStatus\(row\)\}<\/Status>/);
  assert.match(primitives, /<span className="sl-status-dot" aria-hidden="true" \/>/, 'other callers keep the dot');
});

test('long historical identities stay readable without breaking the USER column', () => {
  // The clamp is opt-in, so Admin Audit Logs and the dashboards keep their markup.
  assert.match(auditTable, /constrainActorCell = false/);
  assert.match(auditTable, /className=\{constrainActorCell \? 'sl-emphasized-value sl-audit-actor-cell' : 'sl-emphasized-value'\}/);
  assert.match(auditTable, /title=\{constrainActorCell \? actorName\(row\) : undefined\}/, 'full identity stays reachable');
  assert.match(security, /<AuditTable adminOverview includeSuperAdminActors showSummary=\{false\} constrainActorCell \/>/);
  assert.match(css, /\.sl-audit-actor-cell \{[\s\S]*?max-width:14rem;[\s\S]*?text-overflow:ellipsis;[\s\S]*?white-space:nowrap;/);
  // Stored evidence is never rewritten to make it fit.
  assert.match(auditModel, /actorName: \{ type: String, trim: true, maxlength: 200, immutable: true \}/);
  assert.match(auditModel, /targetName: \{ type: String, trim: true, maxlength: 200, immutable: true \}/);
});

test('every name mutation path enforces the same 1-25 character rule', () => {
  // Client Add/Edit User form.
  assert.match(accounts, /const NAME_LIMIT = 25;/);
  assert.match(accounts, /Enter 1–\$\{NAME_LIMIT\} characters\./);
  assert.match(accounts, /maxLength=\{key === 'firstName' \|\| key === 'lastName' \? NAME_LIMIT : undefined\}/);
  // Server account create/update validator — the authoritative limit.
  assert.match(accountValidator, /value\.trim\(\)\.length > 25/);
  assert.match(accountValidator, /'Enter 1–25 characters'/);
  // Server self-service profile update.
  assert.match(profileUpdate, /const maxLength = 25;/);
  assert.match(profileUpdate, /Enter 1-\$\{maxLength\} characters for the \$\{labels\[field\]\}/);
});

test('Details wording is concise and stays centralized', () => {
  assert.ok(presentation.includes("'Signed in'"), 'LOGIN success reads as Signed in');
  assert.ok(presentation.includes("'Signed out'"), 'LOGOUT success reads as Signed out');
  assert.match(presentation, /return sentence\(`Updated \$\{fields\}`\)/, 'profile update names the changed part');
  // One formatter feeds both surfaces, so table and workbook cannot drift.
  assert.match(administrationService, /detailsDisplay: presentAuditDetails\(item\)/);
  assert.match(auditWorkbook, /safeCell\(presentAuditDetails\(record\)\)/);
  // Presentation only: nothing rewrites the stored record.
  assert.doesNotMatch(presentation, /updateOne|findOneAndUpdate|\.save\(/);
});

test('the Custom Date Range uses the shared control inside the approved audit toolbar', () => {
  // The Super Admin-only bordered/padded/full-row fork is retired.
  assert.doesNotMatch(css, /\.sl-security-activity-v78 \.sl-v219-custom-date-range/);
  assert.match(css, /\.sl-v219-custom-date-range \{[\s\S]*?grid-template-columns: repeat\(2,minmax\(8\.5rem,1fr\)\);/);
  assert.match(css, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] > \.sl-v219-custom-date-range \{[\s\S]*?grid-column:auto;/);
  assert.match(css, /\.sl-admin-audit-records \.sl-audit-filter-strip\[data-layout="audit"\] \{[\s\S]*?grid-template-columns:minmax\(10rem,1\.35fr\)/);
  // From <= To is still enforced by the shared input constraints.
  assert.match(auditTable, /max=\{specificTo \|\| undefined\}/);
  assert.match(auditTable, /min=\{specificFrom \|\| undefined\}/);
});

test('audit queries stay newest-first with a deterministic tie-break', () => {
  // Identical timestamps fall back to the record id, so paging cannot repeat or skip a row.
  assert.match(auditStore, /\{ \[query\.sortBy\]: query\.sortOrder === 'asc' \? 1 : -1, _id: query\.sortOrder === 'asc' \? 1 : -1 \}/);
  assert.match(auditStore, /if \(query\.from \|\| query\.to\) filter\.timestamp = \{ \.\.\.\(query\.from \? \{ \$gte: query\.from \} : \{\}\), \.\.\.\(query\.to \? \{ \$lte: query\.to \} : \{\}\) \}/);
  // The status filter must agree with the model default every presentation
  // surface uses: Success also matches an absent stored status, while Failed and
  // Warning stay exact. Without this, a Status=Success count silently disagrees
  // with the Status badge shown for the very same record.
  assert.match(auditStore, /if \(query\.status\) filter\.status = query\.status === 'Success' \? \{ \$in: \['Success', null\] \} : query\.status;/);
  assert.match(auditModel, /status: \{ type: String, enum: \['Success', 'Failed', 'Warning'\], default: 'Success', immutable: true \}/,
    'the three-value status model with its Success default is pinned');
  assert.match(auditStore, /audits\.countDocuments\(filter\)\.exec\(\)/, 'totals are counted server-side');
});

test('audit visibility and export stay behind Super Admin authorization', () => {
  assert.match(administrationRoutes, /authorizeAdministration\(\['Super Admin', 'Admin'\]\)/);
  assert.ok((administrationRoutes.match(/authorizeAdministration\(\['Super Admin', 'Admin'\]\)/g) ?? []).length >= 3, 'list, export and stream are all guarded');
});

test('a successful sign-in writes exactly one LOGIN record', () => {
  const writes = authRoutes.match(/auditAuthenticationEvent\?\.\('LOGIN'/g) ?? [];
  assert.equal(writes.length, 1, 'no duplicate LOGIN events per sign-in');
  // The write sits after the remember-me handling, so a request that fails before a
  // session is issued never records a sign-in.
  assert.ok(authRoutes.indexOf("auditAuthenticationEvent?.('LOGIN'") > authRoutes.indexOf('await extensions.sessions.revoke(previous)'));
  assert.match(serverSource(), /action, targetType: 'User', targetId: actor\.id, targetName: 'Own account', module: 'Authentication', status: 'Success'/);
});

function serverSource() {
  return read('../../server/src/server.ts');
}
