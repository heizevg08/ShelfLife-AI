import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';

type NotificationItem = { id: string; title: string; message: string; timestamp: string; read: boolean };
const STORAGE_KEY = 'shelflifeai.notifications';

function isNotificationItem(value: unknown): value is NotificationItem {
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
  } catch { return []; }
}

function loadNotifications(): NotificationItem[] {
  try { return parseNotifications(localStorage.getItem(STORAGE_KEY)); }
  catch { return []; }
}

export function Notifications({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => { setItems(loadNotifications()); }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) onChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onChange(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, onChange]);

  const unread = items.filter(item => !item.read).length;
  const markAllRead = () => {
    const next = items.map(item => ({ ...item, read: true }));
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };

  return <div className="sl-notifications" ref={container}>
    <button ref={trigger} className="sl-button sl-icon-button sl-notification-trigger" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
      <Bell size={20} aria-hidden="true" />{unread > 0 && <span className="sl-notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="sl-notifications-panel" className="sl-notification-panel" role="dialog" aria-labelledby="sl-notifications-title">
      <div className="sl-notification-header"><div><h2 id="sl-notifications-title">Notifications</h2><p>{unread ? `${unread} unread` : 'You’re up to date'}</p></div><button type="button" className="sl-button sl-icon-button sl-close-button" aria-label="Close notifications" onClick={() => onChange(false)}><X size={17}/></button></div>
      {items.length ? <><div className="sl-notification-actions"><button type="button" className="sl-button" disabled={!unread} onClick={markAllRead}><CheckCheck size={16}/> Mark all as read</button></div><div className="sl-notification-list">{items.map(item => <article key={item.id} className="sl-notification-item" data-read={item.read}><div><strong>{item.title}</strong><p>{item.message}</p><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString(undefined, { hour12: true })}</time></div></article>)}</div></> : <div className="sl-notification-empty"><Bell size={24} aria-hidden="true"/><strong>No notifications yet</strong><p>System alerts, account activity, and change-request updates will appear here when they are generated.</p></div>}
    </section>}
  </div>;
}
