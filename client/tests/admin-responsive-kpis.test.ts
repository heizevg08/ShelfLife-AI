import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const styles = read('../src/styles/application.css');
const accounts = read('../src/components/application/AccountsTable.tsx');
const modules = read('../src/components/application/ModulePage.tsx');
const dashboard = read('../src/components/dashboard/RoleDashboard.tsx');
const audit = read('../src/components/application/AuditTable.tsx');

test('all Admin KPI routes use the shared responsive grid owner', () => {
  assert.match(dashboard, /sl-dashboard-kpis" aria-label="Establishment inventory overview"/);
  assert.match(accounts, /sl-admin-user-kpis sl-dashboard-kpis" aria-label="Active user management summary"/);
  assert.match(modules, /sl-dashboard-kpis" aria-label="Ingredient summary"/);
  assert.match(modules, /sl-dashboard-kpis" aria-label="Inventory summary"/);
  assert.match(audit, /sl-dashboard-kpis" aria-label="Audit log summary"/);
});

test('Admin KPI columns follow the available Admin container width', () => {
  assert.match(styles, /\.sl-shell\[data-role="Admin"\] \.sl-admin-view \.sl-dashboard-kpis\s*\{\s*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\);/);
  assert.match(styles, /@container \(width<=62rem\)[\s\S]*?\.sl-shell\[data-role="Admin"\] \.sl-admin-view \.sl-dashboard-kpis\s*\{\s*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(styles, /@container \(width<=36rem\)[\s\S]*?\.sl-shell\[data-role="Admin"\] \.sl-admin-view \.sl-dashboard-kpis\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\);/);
  assert.doesNotMatch(styles, /\.sl-shell\[data-role="(?:Manager|Inventory Staff)"\][^{]*\.sl-dashboard-kpis/);
});
