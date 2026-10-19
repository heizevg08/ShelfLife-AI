import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canOpenWorkspacePath, canonicalWorkspaceAccess } from '../src/components/application/workspace';

// Regression contracts for the owner's purpose-corrected System Settings page.
// System Settings is the central location for system-wide configuration: ONE
// compact read-only "System Configuration Overview" container with six concise
// categories, each showing a code-verified implementation status. Shared Status
// chips distinguish implemented fixed rules from deferred configuration
// capability. No invented values, no controls, no KPI cards, no charts, no
// lengthy panels, and no backend boundary.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const settings = read('../src/app/(administration)/SystemSettings.tsx');
const workspace = read('../src/components/application/workspace.ts');
const navigation = read('../src/components/application/administration.ts');
const administrationPage = read('../src/components/application/AdministrationPage.tsx');

test('System Settings page states the approved subtitle', () => {
  assert.match(settings, /View system configuration availability and implementation status\./);
  assert.doesNotMatch(settings, /Manage the global configuration/);
});

test('System Settings page is exactly one container titled System Configuration Overview', () => {
  const cards = settings.match(/<Card\b/g) ?? [];
  assert.equal(cards.length, 1);
  assert.match(settings, /<Card id="system-configuration-overview" title="System Configuration Overview">/);
});

test('The container shows the six mandated categories in order', () => {
  const categories = [
    /<dt>Inventory Policies<\/dt>/,
    /<dt>Waste Management<\/dt>/,
    /<dt>Forecasting<\/dt>/,
    /<dt>Notifications<\/dt>/,
    /<dt>Security &amp; Access<\/dt>/,
    /<dt>Audit &amp; Reporting<\/dt>/,
  ];
  let cursor = 0;
  for (const re of categories) {
    const match = settings.slice(cursor).match(re);
    assert.ok(match, `category required: ${re}`);
    cursor += (match.index ?? 0) + match[0].length;
  }
});

test('Every displayed status is a code-verified existing rule or implementation state', () => {
  // Implemented fixed rules (verified server code).
  assert.match(settings, /seven-day near-expiry window; per-ingredient minimum stock/);
  assert.match(settings, /code-defined waste reasons on immutable records/);
  assert.match(settings, /four canonical roles; System Settings is Super-Admin-only/);
  assert.match(settings, /Active backend audit records; retention not configured/);
  // Deferred capabilities (verified absent backend).
  assert.match(settings, /Awaiting the approved ML forecasting service/);
  assert.match(settings, /Awaiting a verified alert-delivery backend/);
  // Implementation states are stated, never invented as configurable values.
  assert.doesNotMatch(settings, /minimumStock:\s*\d|threshold:\s*\d|retention:\s*\d+|days:\s*\d+/);
});

test('Implemented fixed rules are distinguished from deferred capabilities with shared chips', () => {
  const statuses = settings.match(/<Status\b/g) ?? [];
  assert.equal(statuses.length, 6);
  assert.equal((settings.match(/<Status tone="success">/g) ?? []).length, 4, 'implemented rules');
  assert.equal((settings.match(/<Status tone="attention">/g) ?? []).length, 2, 'deferred capabilities');
  assert.match(settings, /<Status tone="attention">Deferred<\/Status>/);
  assert.match(settings, /<Status tone="success">Implemented<\/Status>/);
});

test('The page stays compact: no KPI cards, charts, panels, or lengthy copy', () => {
  assert.doesNotMatch(settings, /SummaryCards|sl-overview-cards|sl-overview-card/);
  assert.doesNotMatch(settings, /sl-module-columns|sl-settings-panel|<section\b/);
  assert.doesNotMatch(settings, /deferred condition|delivery infrastructure|authoritative/i);
});

test('System Settings page uses the shared design system with no independent CSS or styles', () => {
  assert.match(settings, /import \{[^}]*\} from '\.\.\/\.\.\/components\/application\/primitives'/);
  assert.match(settings, /<PageHeader\b/);
  assert.match(settings, /className="sl-admin-view sl-superadmin-surface/);
  assert.match(settings, /"sl-guidance-list"/);
  assert.doesNotMatch(settings, /styles\//);
  assert.doesNotMatch(settings, /style=\{\{/);
});

test('System Settings page stays read-only: no controls, no state, no backend boundary', () => {
  assert.doesNotMatch(settings, /<(button|input|select|textarea)[\s>]/);
  assert.doesNotMatch(settings, /useState|useEffect|onChange|onSubmit/);
  assert.doesNotMatch(settings, /Save Changes|Apply|\bReset\b/);
  assert.doesNotMatch(settings, /services\//);
  assert.doesNotMatch(settings, /fetch\(|localStorage|typeof window/);
});

test('/SystemSettings is removed from canonical workspace access and denied for all roles', () => {
  assert.equal(canonicalWorkspaceAccess['/SystemSettings' as keyof typeof canonicalWorkspaceAccess], undefined);
  const roles = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;
  for (const role of roles) {
    assert.equal(canOpenWorkspacePath(role, '/SystemSettings'), false, `${role} at /SystemSettings`);
  }
});

test('Super Admin sidebar removes the System Settings navigation entry', () => {
  assert.doesNotMatch(navigation, /id: 'settings', path: '\/SystemSettings', label: 'System Settings'/);
});

// The legacy generic renderer still carries the retired settings preview branch.
// It is dead code — the only call site is UserManagement with areaId="accounts" —
// so this guard fails loudly if it ever becomes reachable with the old subtitle.
test('Legacy AdministrationPage settings branch stays unreachable dead code', () => {
  assert.match(administrationPage, /areaId === 'accounts'/);
  assert.doesNotMatch(read('../src/app/(administration)/UserManagement.tsx'), /areaId=("|')(security|settings)/);
});
