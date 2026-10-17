import type { DashboardSummary } from '../services/administration';

export const roleOrder = ['Inventory Staff', 'Manager', 'Admin', 'Super Admin'] as const;
export const rolePalette = {
  'Inventory Staff': '#0b8755',
  'Manager': '#79c9a3',
  'Admin': '#ffd166',
  'Super Admin': '#133320',
} as const;

export function buildAccountAnalytics(summary: DashboardSummary | null) {
  const total = summary?.totalUsers ?? 0;
  const counts = roleOrder.map(role => summary?.roleCounts?.[role] ?? 0);
  const largest = Math.max(...counts, 1);
  return {
    total,
    active: summary?.activeUsers ?? 0,
    inactive: summary?.inactiveUsers ?? 0,
    reconciles: Boolean(summary) && counts.reduce((sum, count) => sum + count, 0) === total
      && (summary?.activeUsers ?? 0) + (summary?.inactiveUsers ?? 0) === total,
    roles: roleOrder.map((role, index) => ({
      role,
      count: counts[index],
      percentage: total ? Math.round((counts[index] / total) * 100) : 0,
      barWidth: (counts[index] / largest) * 100,
      color: rolePalette[role],
    })),
  };
}
