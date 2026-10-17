import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const styles = read('../src/styles/application.css');
const audit = read('../src/components/application/AuditTable.tsx');

test('Administrative Audit removes the Module filter without changing the Module table column', () => {
  assert.doesNotMatch(audit, /moduleFilter|Filter audit records by module|<span>Module<\/span>/);
  assert.match(audit, /<th scope="col">Module<\/th>/);
});
test('Admin table and toolbar standards are owned by Admin-scoped container rules', () => {
  assert.match(styles, /\.sl-shell\[data-role="Admin"\] \.sl-admin-view table \.sl-status-dot\s*\{\s*display:\s*none;/);
  assert.match(styles, /@container \(width<=36rem\)[\s\S]*?data-layout="users"/);
  assert.match(styles, /\.sl-shell\[data-role="Admin"\][\s\S]*?\.sl-application-records-table-shell[\s\S]*?overflow-x: auto/);
  assert.match(styles, /\.sl-shell\[data-role="Admin"\][\s\S]*?:is\(\.sl-button,\.sl-icon-button,\.sl-filter-select-trigger,input,select\)[\s\S]*?min-height: 44px/);
});
