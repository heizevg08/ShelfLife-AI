import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Manager Dashboard Alert Records card replaces Upcoming Expirations
test('Manager Dashboard Alert Records card renders live alerts and handles states', () => {
  const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
  const patterns = readFileSync(new URL('../src/components/application/ApplicationPatterns.tsx', import.meta.url), 'utf8');
  const primitives = readFileSync(new URL('../src/components/application/primitives.tsx', import.meta.url), 'utf8');

  // Alert Records card is present in Manager Dashboard
  assert.match(dashboard, /id="manager-alert-records"/);

  // Successful-empty: truthful DataState with no preview badge.
  const alertCard = dashboard.slice(dashboard.indexOf('id="manager-alert-records"'), dashboard.indexOf('id="manager-pending-requests"'));
  assert.doesNotMatch(alertCard, /ApplicationPendingState/);
  assert.doesNotMatch(alertCard, /No live records yet/);
  assert.doesNotMatch(alertCard, /Preview · data pending/);

  // The shared pending primitive itself is unchanged for genuinely unavailable data elsewhere.
  assert.match(patterns, /title="No live records yet"/);
  assert.match(primitives, /kind\?: 'unavailable' \| 'empty' \| 'error' \| 'permission' \| 'loading'/);
});
