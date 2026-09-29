import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Info, RefreshCw, X } from 'lucide-react';
import { listAccountRequests } from '../../services/accountRequests';
import { listIngredientRequests } from '../../services/ingredientRequests';
import type { SessionUser } from '../../services/auth';
import { Link } from '../../routing/navigation';

type NotificationItem = { id: string; title: string; message: string; timestamp: string; read: boolean; href?: string };
type Category = 'All' | 'Accounts' | 'Ingredients';
const STORAGE_KEY = 'shelflifeai.notifications';
const DISMISSED_KEY = 'shelflifeai.dismissed-notifications';

function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id && typeof item.title === 'string' && typeof item.message === 'string'
    && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp)) && typeof item.read === 'boolean'
    && (item.href === undefined || typeof item.href === 'string');
}

export function parseNotifications(raw: string | null): NotificationItem[] {
  if (!raw) return [];
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) && value.every(isNotificationItem) ? value : []; }
  catch { return []; }
}
function loadNotifications() { try { return parseNotifications(localStorage.getItem(STORAGE_KEY)); } catch { return []; } }
function loadDismissed() {
  try { const value: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); return Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : []; }
  catch { return []; }
}

export function Notifications({ user, open, onChange }: { user: SessionUser; open: boolean; onChange: (open: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [category, setCategory] = useState<Category>('All');
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [accountResult, ingredientResult] = await Promise.allSettled([listAccountRequests(), listIngredientRequests()]);
      if (!alive) return;
      const readIds = new Set(loadNotifications().filter(item => item.read).map(item => item.id));
      const dismissedIds = new Set(loadDismissed());
      const generated: Omit<NotificationItem, 'read'>[] = [];
      if (accountResult.status === 'fulfilled') for (const request of accountResult.value.items) {
        const mine = request.requestedBy.id === user.id;
        if (!mine && request.status === 'Pending' && (user.role === 'Admin' || user.role === 'Super Admin')) generated.push({ id: `account:${request.id}:pending`, title: 'New account request', message: `${request.requestedBy.name} requested an account for ${request.firstName} ${request.lastName} (${request.role}).`, timestamp: request.createdAt, href: '/AccountRequests' });
        if (mine && request.status !== 'Pending') generated.push({ id: `account:${request.id}:${request.status}`, title: `Account request ${request.status.toLowerCase()}`, message: `Your request for ${request.firstName} ${request.lastName} was ${request.status.toLowerCase()} by ${request.reviewedBy?.name ?? 'an administrator'}.${request.reviewNote ? ` Note: ${request.reviewNote}` : ''}`, timestamp: request.updatedAt, href: '/AccountRequests' });
      }
      if (ingredientResult.status === 'fulfilled') for (const request of ingredientResult.value.items) {
        const mine = request.createdBy.id === user.id;
        if (!mine && request.status === 'Pending' && ['Inventory Manager', 'Admin', 'Super Admin'].includes(user.role)) generated.push({ id: `ingredient:${request.id}:pending`, title: 'New ingredient request', message: `${request.createdBy.name} requested approval for ${request.name}.`, timestamp: request.createdAt, href: '/Ingredients' });
        if (mine && request.status !== 'Pending') generated.push({ id: `ingredient:${request.id}:${request.status}`, title: `Ingredient request ${request.status.toLowerCase()}`, message: `Your ingredient request for ${request.name} was ${request.status.toLowerCase()} by ${request.reviewedBy?.name ?? 'a manager'}.${request.reviewNote ? ` Note: ${request.reviewNote}` : ''}`, timestamp: request.updatedAt, href: '/Ingredients' });
      }
      const next = generated.filter(item => !dismissedIds.has(item.id)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 30).map(item => ({ ...item, read: readIds.has(item.id) }));
      setItems(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
      setRefreshing(false);
    };
    setItems(loadNotifications());
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [user.id, user.role, refreshTick]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) onChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onChange(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, onChange]);

  const persist = (next: NotificationItem[]) => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional */ }
  };
  const unread = items.filter(item => !item.read).length;
  const markAllRead = () => persist(items.map(item => ({ ...item, read: true })));
  const markRead = (id: string) => persist(items.map(item => item.id === id ? { ...item, read: true } : item));
  const dismiss = (id: string) => {
    const dismissed = [...new Set([...loadDismissed(), id])].slice(-100);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed)); } catch { /* optional */ }
    persist(items.filter(item => item.id !== id));
  };
  const accountCount = items.filter(item => item.id.startsWith('account:')).length;
  const ingredientCount = items.filter(item => item.id.startsWith('ingredient:')).length;
  const visibleItems = items.filter(item => category === 'All' || item.id.startsWith(category === 'Accounts' ? 'account:' : 'ingredient:'));
  const latestTarget = items.find(item => item.href)?.href;

  return <div className="sl-notifications" ref={container}>
    <button ref={trigger} className="sl-button sl-icon-button sl-notification-trigger" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
      <Bell size={20} aria-hidden="true" />{unread > 0 && <span className="sl-notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="sl-notifications-panel" className="sl-notification-panel sl-notification-center" role="dialog" aria-labelledby="sl-notifications-title">
      <header className="sl-notification-header"><div><h2 id="sl-notifications-title">Notifications</h2><p>{unread ? `${unread} unread` : 'You’re all caught up'}</p></div><div className="sl-notification-header-actions"><button type="button" className="sl-notification-icon-button" aria-label="Refresh notifications" disabled={refreshing} onClick={() => { setRefreshing(true); setRefreshTick(value => value + 1); }}><RefreshCw size={16} className={refreshing ? 'sl-notification-spinning' : ''}/></button><button type="button" className="sl-notification-icon-button" aria-label="Close notifications" onClick={() => onChange(false)}><X size={18}/></button></div></header>
      <div className="sl-notification-tabs" role="tablist" aria-label="Notification categories">{([['All', items.length], ['Accounts', accountCount], ['Ingredients', ingredientCount]] as const).map(([label, count]) => <button key={label} type="button" role="tab" aria-selected={category === label} className={category === label ? 'active' : ''} onClick={() => setCategory(label)}>{label}<span>{count}</span></button>)}</div>
      {visibleItems.length ? <><div className="sl-notification-list">{visibleItems.map(item => {
        const isOpen = expanded.includes(item.id);
        const kind = item.id.endsWith(':Rejected') ? 'rejected' : item.id.endsWith(':Approved') ? 'approved' : 'new';
        const KindIcon = kind === 'rejected' ? CircleAlert : kind === 'approved' ? CircleCheck : Info;
        return <article key={item.id} className="sl-notification-item" data-read={item.read} data-kind={kind}>
          <div className="sl-notification-row"><KindIcon className="sl-notification-kind-icon" size={18} aria-hidden="true"/><button type="button" className="sl-notification-expand" aria-expanded={isOpen} onClick={() => setExpanded(current => isOpen ? current.filter(id => id !== item.id) : [...current, item.id])}><strong>{item.title}</strong><span className="sl-notification-chevron">{isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span></button><button type="button" className="sl-notification-dismiss" aria-label={`Dismiss ${item.title}`} onClick={() => dismiss(item.id)}><X size={15}/></button></div>
          {isOpen && <div className="sl-notification-details"><p>{item.message}</p><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</time>{item.href && <Link href={item.href} className="sl-notification-open-link" onClick={() => { markRead(item.id); onChange(false); }}>Open request</Link>}</div>}
        </article>;
      })}</div><footer className="sl-notification-footer"><button type="button" className="sl-notification-mark-read" disabled={!unread} onClick={markAllRead}>Mark all as read</button>{latestTarget ? <Link href={latestTarget} className="sl-notification-center-link" onClick={() => { markAllRead(); onChange(false); }}>Go to notification center</Link> : <button type="button" className="sl-notification-center-link" disabled>Go to notification center</button>}</footer></> : <div className="sl-notification-empty"><Bell size={24} aria-hidden="true"/><strong>No {category === 'All' ? '' : `${category.toLowerCase()} `}notifications</strong><p>New requests and their decisions will show up here.</p></div>}
    </section>}
  </div>;
}
