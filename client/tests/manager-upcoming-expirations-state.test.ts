import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Manager Upcoming Expirations data-state correctness: a successful API
// response with zero qualifying batches is a truthful empty state, not
// pending data, and must never carry the preview badge.
test('Manager Upcoming Expirations distinguishes successful-empty from loading, error, and populated states', () => {
  const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
  const patterns = readFileSync(new URL('../src/components/application/ApplicationPatterns.tsx', import.meta.url), 'utf8');
  const primitives = readFileSync(new URL('../src/components/application/primitives.tsx', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/services/inventory-batches.ts', import.meta.url), 'utf8');

  // Contract: dashboard requests the first page of backend-classified
  // Near Expiry batches in FEFO order plus the canonical summary.
  assert.match(dashboard, /listInventoryBatches\(\{ page: 1, pageSize: 5, status: 'Near Expiry', sort: 'fefo' \}/);
  assert.match(dashboard, /getInventoryBatchSummary\(controller\.signal\)/);
  assert.match(service, /`\/inventory-batches\?\$\{params\}`/);
  assert.match(service, /'\/inventory-batches\/summary'/);

  // Populated: rows render from the live `expirations` response.
  assert.match(dashboard, /expirations\?\.length \? expirations\.map\(batch =>/);

  // Loading vs error: recordState maps loading to "Loading records" and
  // failure to "Data unavailable" with the error kind.
  assert.match(dashboard, /recordState\(4, expirations === null && !inventoryError, inventoryError,/);
  assert.match(dashboard, /title=\{failed \? 'Data unavailable' : loading \? 'Loading records'/);

  // Successful-empty: truthful DataState with no preview badge.
  assert.match(dashboard, /<DataState kind="empty" title="No upcoming expirations" description="No batches expire within the next 7 days\." \/>/);
  const expirationsCard = dashboard.slice(dashboard.indexOf('id="manager-upcoming-expirations"'), dashboard.indexOf('id="manager-pending-requests"'));
  assert.doesNotMatch(expirationsCard, /ApplicationPendingState/);
  assert.doesNotMatch(expirationsCard, /No live records yet/);
  assert.doesNotMatch(expirationsCard, /Preview · data pending/);

  // The shared pending primitive itself is unchanged for genuinely
  // unavailable data elsewhere.
  assert.match(patterns, /title="No live records yet"/);
  assert.match(primitives, /kind\?: 'unavailable' \| 'empty' \| 'error' \| 'permission' \| 'loading'/);
});
