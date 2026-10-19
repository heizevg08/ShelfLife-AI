import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const audit = read('../src/components/application/AuditTable.tsx');
const service = read('../src/services/administration.ts');

test('Audit Logs Details column prefers the server-composed presentation sentence', () => {
  assert.match(audit, /row\.detailsDisplay \?\? auditDetails\(row\)/);
  assert.match(service, /detailsDisplay\?: string/);
  assert.match(audit, /const auditDetails = \(row: AuditRecord\)/);
  assert.match(audit, /LOGIN: 'Signed in', LOGOUT: 'Signed out'/);
});

test('audit presentation stays a client fallback and never rewrites stored details', () => {
  assert.doesNotMatch(audit, /row\.details = /);
  assert.doesNotMatch(service, /details:/);
});
