import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
const adminStart = dashboard.indexOf('function AdminDashboardContent');
const adminEnd = dashboard.indexOf('function ManagerDashboardContent');
const admin = dashboard.slice(adminStart, adminEnd);

test('Admin inventory overview loads live summary data and exposes retry states', () => {
  assert.match(admin, /getInventoryBatchSummary\(abort\.signal\)/);
  assert.match(admin, /attempt < 2/);
  assert.match(admin, /setInventoryRetry\(value => value \+ 1\)/);
  assert.match(admin, /centerValue=\{inventorySummary\.totalBatches\}/);
  assert.match(admin, /Object\.entries\(inventorySummary\.statusCounts\)/);
  assert.match(admin, /kind="error" title="Inventory unavailable"/);
  assert.match(admin, /kind="loading" title="Loading inventory"/);
  assert.doesNotMatch(admin, /Inventory status records will appear when the inventory batch service is connected/);
});
