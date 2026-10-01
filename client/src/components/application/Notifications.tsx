import { useEffect, useRef, useState } from 'react';
import { AtSign, Bell, CheckCheck, Clock3, Inbox, Users, X } from 'lucide-react';
import { Link } from '../../routing/navigation';
import type { SessionUser } from '../../services/auth';
import { canOpenWorkspacePath, dashboardPaths, type WorkspaceRole } from './workspace';

type NotificationCategory = 'request' | 'mention' | 'urgent' | 'activity';
type NotificationItem = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category?: NotificationCategory;
  href?: string;
  actor?: string;
};
type NotificationTab = 'all' | 'request' | 'mention' | 'urgent';
const STORAGE_KEY = 'shelflifeai.notifications';

function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id
    && typeof item.title === 'string'
    && typeof item.message === 'string'
    && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp))
    && typeof item.read === 'boolean'
    && (item.category === undefined || ['request', 'mention', 'urgent', 'activity'].includes(item.category as string))
    && (item.href === undefined || typeof item.href === 'string')
    && (item.actor === undefined || typeof item.actor === 'string');
}

export function parseNotifications(raw: string | null): NotificationItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isNotificationItem) ? value : [];
  } catch { return []; }
}

function loadNotifications(): NotificationItem[] {
  try { return parseNotifications(localStorage.getItem(STORAGE_KEY)); }
  catch { return []; }
}

function categoryFor(item: NotificationItem): NotificationCategory {
  if (item.category) return item.category;
  const text = `${item.title} ${item.message}`.toLowerCase();
  if (/urgent|critical|expired|overdue|risk/.test(text)) return 'urgent';
  if (/mention|mentioned|@\w+/.test(text)) return 'mention';
  if (/request|approval|review|invited/.test(text)) return 'request';
  return 'activity';
}

function destinationFor(item: NotificationItem, role: WorkspaceRole): string {
  const text = `${item.title} ${item.message}`.toLowerCase();
  const candidate = item.href && item.href.startsWith('/') && !item.href.startsWith('//')
    ? item.href
    : /account request/.test(text) ? '/AccountRequests'
      : /change request/.test(text) ? '/ChangeRequests'
        : /ingredient/.test(text) ? '/Ingredients'
          : /inventory|stock[- ]?in|batch/.test(text) ? (role === 'Inventory Manager' ? '/Inventory' : '/InventoryBatches')
            : /alert|expiration|expired/.test(text) ? '/Alerts'
          : dashboardPaths[role];
  return canOpenWorkspacePath(role, candidate) ? candidate : dashboardPaths[role];
}

function relativeTime(timestamp: string) {
  const elapsed = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'SL';
}

export function Notifications({ open, onChange, user }: { open: boolean; onChange: (open: boolean) => void; user: Pick<SessionUser, 'role'> }) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [tab, setTab] = useState<NotificationTab>('all');

  useEffect(() => { setItems(loadNotifications()); }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) onChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onChange(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, onChange]);

  const unread = items.filter(item => !item.read).length;
  const counts: Record<NotificationTab, number> = {
    all: items.length,
    request: items.filter(item => categoryFor(item) === 'request').length,
    mention: items.filter(item => categoryFor(item) === 'mention').length,
    urgent: items.filter(item => categoryFor(item) === 'urgent').length,
  };
  const visibleItems = tab === 'all' ? items : items.filter(item => categoryFor(item) === tab);
  const saveItems = (next: NotificationItem[]) => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };
  const markRead = (id: string) => saveItems(items.map(item => item.id === id ? { ...item, read: true } : item));
  const markAllRead = () => saveItems(items.map(item => ({ ...item, read: true })));

  return <div className="sl-notifications" ref={container}>
    <button ref={trigger} className="sl-button sl-icon-button sl-notification-trigger" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
      <Bell size={20} aria-hidden="true" />{unread > 0 && <span className="sl-notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="sl-notifications-panel" className="sl-notification-panel" role="dialog" aria-labelledby="sl-notifications-title">
      <div className="sl-notification-header">
        <h2 id="sl-notifications-title">Notifications</h2>
        {unread > 0 && <button type="button" className="sl-notification-mark-read" onClick={markAllRead}><CheckCheck size={15} aria-hidden="true" /> Mark all read</button>}
        <button type="button" className="sl-button sl-icon-button sl-close-button" aria-label="Close notifications" onClick={() => onChange(false)}><X size={17}/></button>
      </div>
      <div className="sl-notification-tabs" role="tablist" aria-label="Filter notifications">
        {([
          ['all', 'All', Inbox],
          ['request', 'Requests', Users],
          ['mention', 'Mentions', AtSign],
          ['urgent', 'Urgent', Clock3],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            <Icon size={15} aria-hidden="true" /> <span>{label}</span>{counts[id] > 0 && <span className="sl-notification-tab-count">{counts[id]}</span>}
          </button>
        ))}
      </div>
      {visibleItems.length ? <div className="sl-notification-list">
        {visibleItems.map(item => {
          const category = categoryFor(item);
          const href = destinationFor(item, user.role);
          const content = <>
            <span className="sl-notification-avatar" aria-hidden="true">{initials(item.actor || item.title)}</span>
            <span className="sl-notification-copy">
              <span className="sl-notification-message"><strong>{item.actor || item.title}</strong>{item.actor ? ` ${item.title}` : ''}</span>
              {item.actor && <span className="sl-notification-detail">{item.message}</span>}
              {!item.actor && item.message && <span className="sl-notification-detail">{item.message}</span>}
            </span>
            <time dateTime={item.timestamp}>{relativeTime(item.timestamp)}</time>
            {!item.read && <span className="sl-notification-unread-dot" aria-label="Unread" />}
          </>;
          return href
            ? <article key={item.id} className="sl-notification-item" data-read={item.read} data-category={category}>
                <Link href={href} className="sl-notification-link" onClick={() => { markRead(item.id); onChange(false); }}>{content}</Link>
              </article>
            : <article key={item.id} className="sl-notification-item" data-read={item.read} data-category={category}>
                <button type="button" className="sl-notification-link" onClick={() => markRead(item.id)} aria-label={`${item.title}. ${item.message}`}>
                  {content}
                </button>
              </article>;
        })}
      </div> : <div className="sl-notification-empty"><Bell size={24} aria-hidden="true"/><strong>{items.length ? 'Nothing in this category' : 'No notifications yet'}</strong><p>{items.length ? 'Choose another tab to see more activity.' : 'System alerts, requests, and inventory updates will appear here.'}</p></div>}
    </section>}
  </div>;
}
