export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  kind?: 'request' | 'stock' | 'system' | 'security';
  requestId?: string;
  batchId?: string;
  targetPath?: string;
  status?: string;
};

export function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id
    && typeof item.title === 'string'
    && typeof item.message === 'string'
    && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp))
    && typeof item.read === 'boolean';
}

export function parseNotifications(raw: string | null): NotificationItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isNotificationItem) ? value : [];
  } catch {
    return [];
  }
}
