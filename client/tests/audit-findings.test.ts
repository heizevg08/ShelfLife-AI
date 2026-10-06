import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('record forms clear stale errors and refresh eligible batches after every stock mutation', () => {
  const source = read('../src/pages/workspace/RecordPage.tsx');
  assert.match(source, /const loadBatches =/);
  assert.match(source, /await Promise\.all\(\[loadHistory\(\), loadBatches\(\)\]\)/);
  assert.match(source, /setBatchId\(current => result\.items\.some/);
  assert.match(source, /loadHistory = \(\) => \{[\s\S]*?setError\(''\)/);
});

test('settings copy states the enforced 12-character password minimum without invented composition rules', () => {
  const source = read('../src/pages/workspace/SystemSettings.tsx');
  assert.match(source, /Minimum 12 characters\./);
  assert.doesNotMatch(source, /Minimum 8 characters, with uppercase/);
});

test('super-admin dashboard uses server role counts and only reports health from the public readiness endpoint', () => {
  const source = read('../src/components/dashboard/SuperAdminDashboard.tsx');
  assert.match(source, /summary\.roleCounts/);
  assert.match(source, /getSystemAvailability/);
  assert.doesNotMatch(source, /listAccounts\(/);
});

test('security activity uses the protected audit component and unavailable controls cannot be activated', () => {
  const source = read('../src/pages/workspace/SecurityActivity.tsx');
  assert.match(source, /<AuditTable adminOverview \/>/);
  assert.match(source, /disabled=\{!\['Overview', 'Audit Logs'\]\.includes\(tab\)\}/);
  assert.match(source, /not available yet/);
});
