import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAccountAnalytics } from '../src/utils/account-analytics';

test('Super Admin account analytics use total-share percentages and largest-role bar scaling', () => {
  const result = buildAccountAnalytics({
    totalUsers: 13,
    activeUsers: 8,
    inactiveUsers: 5,
    roleCounts: { 'Inventory Staff': 5, Manager: 4, Admin: 2, 'Super Admin': 2 },
  });

  assert.equal(result.reconciles, true);
  assert.deepEqual(result.roles.map(({ role, count, percentage }) => ({ role, count, percentage })), [
    { role: 'Inventory Staff', count: 5, percentage: 38 },
    { role: 'Manager', count: 4, percentage: 31 },
    { role: 'Admin', count: 2, percentage: 15 },
    { role: 'Super Admin', count: 2, percentage: 15 },
  ]);
  assert.deepEqual(result.roles.map(({ barWidth }) => barWidth), [100, 80, 40, 40]);
});

test('Super Admin account analytics keep valid empty categories and zero-account state truthful', () => {
  const result = buildAccountAnalytics({ totalUsers: 0, activeUsers: 0, inactiveUsers: 0, roleCounts: {} });
  assert.equal(result.reconciles, true);
  assert.deepEqual(result.roles.map(({ count, percentage, barWidth }) => ({ count, percentage, barWidth })), [
    { count: 0, percentage: 0, barWidth: 0 },
    { count: 0, percentage: 0, barWidth: 0 },
    { count: 0, percentage: 0, barWidth: 0 },
    { count: 0, percentage: 0, barWidth: 0 },
  ]);
});

test('Super Admin account analytics expose a reconciliation mismatch', () => {
  const result = buildAccountAnalytics({
    totalUsers: 4,
    activeUsers: 3,
    inactiveUsers: 1,
    roleCounts: { Admin: 1, Manager: 1 },
  });
  assert.equal(result.reconciles, false);
});
