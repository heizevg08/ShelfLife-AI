import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Bell, Check, CheckCheck, CheckCircle2, Clock3, Leaf, ListChecks, RefreshCw, ShieldCheck, UserRoundPlus, X, XCircle } from 'lucide-react';
import type { SessionUser } from '../../services/auth';
import { fetchNotifications, type NotificationItem, type NotificationReviewAction, type NotificationSource } from '../../services/notifications';
import { useRouter } from '../../routing/navigation';
import { canOpenWorkspacePath, dashboardPaths } from './workspace';
import { reviewAccountRequest } from '../../services/accountRequests';
import { approveChangeRequest, rejectChangeRequest } from '../../services/changeRequests';
import { reviewIngredientRequest } from '../../services/ingredientRequests';
import { Dialog } from './Dialog';

const SOURCES: NotificationSource[] = ['audit', 'account-request', 'change-request', 'ingredient-request', 'inventory-batch', 'inventory-summary'];
const storageKey = (user: SessionUser) => `shelflifeai.notifications.${user.id}.${user.role}`;

function isNotificationReviewAction(value: unknown): value is NotificationReviewAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return ['account-request', 'change-request', 'ingredient-request'].includes(String(action.type))
    && typeof action.requestId === 'string' && !!action.requestId
    && typeof action.expectedVersion === 'number' && Number.isInteger(action.expectedVersion) && action.expectedVersion >= 0;
}

function isNotificationItem(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && !!item.id
    && typeof item.source === 'string' && SOURCES.includes(item.source as NotificationSource)
    && typeof item.title === 'string'
    && typeof item.message === 'string'
    && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp))
    && typeof item.read === 'boolean'
    && (item.reviewAction === undefined || isNotificationReviewAction(item.reviewAction));
}

type NotificationReview = { item: NotificationItem; decision: 'Approved' | 'Rejected' };

export function parseNotifications(raw: string | null): NotificationItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isNotificationItem) ? value : [];
  } catch { return []; }
}

function loadNotifications(key: string): NotificationItem[] {
  try { return parseNotifications(localStorage.getItem(key)); }
  catch { return []; }
}

function saveNotifications(key: string, items: NotificationItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); }
  catch { /* Notifications still work for the current session when storage is unavailable. */ }
}

function notificationDestination(item: NotificationItem, user: SessionUser): string {
  switch (item.source) {
    case 'audit': return '/AdministrativeAudit';
    case 'account-request': return '/AccountRequests';
    case 'change-request': return '/ChangeRequests';
    case 'ingredient-request': return '/Ingredients';
    case 'inventory-batch': return user.role === 'Admin' ? '/InventoryBatches' : '/ExpirationMonitoring';
    case 'inventory-summary': return '/Alerts';
  }
  return dashboardPaths[user.role];
}

function notificationIcon(source: NotificationSource) {
  switch (source) {
    case 'audit': return ShieldCheck;
    case 'account-request': return UserRoundPlus;
    case 'change-request': return ListChecks;
    case 'ingredient-request': return Leaf;
    case 'inventory-batch': return Clock3;
    case 'inventory-summary': return Activity;
  }
  return Bell;
}

export function Notifications({ user, open, onChange }: { user: SessionUser; open: boolean; onChange: (open: boolean) => void }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<NotificationItem[]>([]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<NotificationSource[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showAll, setShowAll] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<NotificationReview | null>(null);
  const [reviewPassword, setReviewPassword] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewNotice, setReviewNotice] = useState('');
  const key = storageKey(user);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const cachedOnStart = loadNotifications(key);
    itemsRef.current = cachedOnStart;
    setItems(cachedOnStart);
    setFailedSources([]);
    setLoadError(false);
    setLoading(true);

    const refresh = async () => {
      try {
        const feed = await fetchNotifications(user, controller.signal);
        if (!active) return;
        const cached = loadNotifications(key);
        const knownItems = [...new Map([...cached, ...itemsRef.current].map(item => [item.id, item] as const)).values()];
        const readState = new Map(knownItems.map(item => [item.id, item.read] as const));
        const refreshed = feed.items.map(item => ({ ...item, read: readState.get(item.id) ?? item.read }));
        const refreshedIds = new Set(refreshed.map(item => item.id));
        const retainedFromFailedSources = knownItems.filter(item => feed.failedSources.includes(item.source) && !refreshedIds.has(item.id));
        const next = [...refreshed, ...retainedFromFailedSources]
          .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
          .slice(0, 50);
        itemsRef.current = next;
        setItems(next);
        setFailedSources(feed.failedSources);
        setLoadError(false);
        saveNotifications(key, next);
      } catch {
        if (!active || controller.signal.aborted) return;
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [key, open, retry, user, user.id, user.role]);

  useEffect(() => {
    const syncReadState = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        const next = parseNotifications(event.newValue);
        itemsRef.current = next;
        setItems(next);
      }
    };
    window.addEventListener('storage', syncReadState);
    return () => window.removeEventListener('storage', syncReadState);
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) onChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !reviewTarget) { onChange(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, onChange, reviewTarget]);

  const unread = items.filter(item => !item.read).length;
  const markRead = (id: string, clearReviewAction = false) => {
    const next = itemsRef.current.map(item => item.id === id
      ? { ...item, read: true, ...(clearReviewAction ? { reviewAction: undefined } : {}) }
      : item);
    itemsRef.current = next;
    setItems(next);
    saveNotifications(key, next);
  };
  const markAllRead = () => {
    const next = itemsRef.current.map(item => ({ ...item, read: true }));
    itemsRef.current = next;
    setItems(next);
    saveNotifications(key, next);
  };
  const startReview = (item: NotificationItem, decision: NotificationReview['decision']) => {
    setReviewTarget({ item, decision });
    setReviewPassword('');
    setReviewNote('');
    setReviewError('');
    setReviewNotice('');
  };
  const submitReview = async () => {
    const target = reviewTarget;
    const action = target?.item.reviewAction;
    if (!target || !action || reviewBusy) return;
    if (action.type === 'account-request' && target.decision === 'Approved' && reviewPassword.trim().length < 12) {
      setReviewError('Enter an initial password with at least 12 non-whitespace characters.');
      return;
    }
    if (action.type === 'change-request' && target.decision === 'Rejected' && !reviewNote.trim()) {
      setReviewError('Enter a review note before rejecting this change request.');
      return;
    }

    setReviewBusy(true);
    setReviewError('');
    try {
      if (action.type === 'account-request') {
        await reviewAccountRequest(action.requestId, target.decision, action.expectedVersion, target.decision === 'Approved' ? reviewPassword : undefined);
      } else if (action.type === 'ingredient-request') {
        await reviewIngredientRequest(action.requestId, target.decision, action.expectedVersion);
      } else if (target.decision === 'Approved') {
        await approveChangeRequest(action.requestId, action.expectedVersion, reviewNote.trim());
      } else {
        await rejectChangeRequest(action.requestId, action.expectedVersion, reviewNote.trim());
      }
      markRead(target.item.id, true);
      setReviewNotice(`${target.decision === 'Approved' ? 'Approved' : 'Rejected'}: ${target.item.title}.`);
      setReviewTarget(null);
      setRetry(value => value + 1);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'The request could not be reviewed. Try again.');
    } finally {
      setReviewBusy(false);
    }
  };
  const openNotification = (item: NotificationItem) => {
    markRead(item.id);
    onChange(false);
    const destination = notificationDestination(item, user);
    router.push(canOpenWorkspacePath(user.role, destination) ? destination : dashboardPaths[user.role]);
  };
  const filteredItems = filter === 'unread' ? items.filter(item => !item.read) : items;
  const displayedItems = showAll ? filteredItems : filteredItems.slice(0, 5);
  const needsInitialPassword = reviewTarget?.item.reviewAction?.type === 'account-request' && reviewTarget.decision === 'Approved';
  const needsReviewNote = reviewTarget?.item.reviewAction?.type === 'change-request' && reviewTarget.decision === 'Rejected';
  const statusText = unread ? `${unread} unread` : loading ? 'Checking for updates…' : failedSources.length || loadError ? 'Some activity unavailable' : 'You’re up to date';

  return <div className="sl-notifications" ref={container}>
    <button ref={trigger} className="sl-button sl-icon-button sl-notification-trigger" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
      <Bell size={20} aria-hidden="true" />{unread > 0 && <span className="sl-notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="sl-notifications-panel" className="sl-notification-panel" role="dialog" aria-labelledby="sl-notifications-title">
      <div className="sl-notification-header">
        <div className="sl-notification-heading"><h2 id="sl-notifications-title">Notifications</h2><p>{statusText}</p></div>
        <div className="sl-notification-header-actions">
          <button type="button" className="sl-notification-mark-all" disabled={!unread} onClick={markAllRead}><CheckCheck size={15} aria-hidden="true"/>Mark all as read</button>
          <button type="button" className="sl-button sl-icon-button sl-close-button" aria-label="Close notifications" onClick={() => onChange(false)}><X size={17}/></button>
        </div>
      </div>
      <div className="sl-notification-tabs" role="group" aria-label="Notification filter">
        <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => { setFilter('all'); setShowAll(false); }}>All <span>{items.length}</span></button>
        <button type="button" aria-pressed={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => { setFilter('unread'); setShowAll(false); }}>Unread <span>{unread}</span></button>
      </div>
      {reviewNotice && <p className="sl-notification-result" role="status">{reviewNotice}</p>}
      {items.length > 0 && (failedSources.length > 0 || loadError) && <div className="sl-notification-feedback" role="status"><span>Some activity could not be refreshed.</span><button type="button" className="sl-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} aria-hidden="true"/> Retry</button></div>}
      {items.length ? <>
        {filteredItems.length ? <div className="sl-notification-list">{displayedItems.map(item => {
          const Icon = notificationIcon(item.source);
          return <article key={item.id} className="sl-notification-item" data-read={item.read}>
            <button type="button" className="sl-notification-open" onClick={() => openNotification(item)} aria-label={`${item.title}. ${item.message} Open notification.`}>
              <span className="sl-notification-avatar" data-source={item.source}><Icon size={18} aria-hidden="true"/></span>
              <span className="sl-notification-copy"><strong>{item.title}</strong><span className="sl-notification-message">{item.message}</span><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString(undefined, { hour12: true })}</time></span>
              <ArrowRight className="sl-notification-arrow" size={21} aria-hidden="true"/>
            </button>
            {item.reviewAction && <div className="sl-notification-review-actions">
              <button type="button" className="sl-button sl-notification-reject" aria-label={`Reject ${item.title}`} disabled={reviewBusy} onClick={() => startReview(item, 'Rejected')}><XCircle size={14} aria-hidden="true"/>Reject</button>
              <button type="button" className="sl-button sl-button-primary" aria-label={`Approve ${item.title}`} disabled={reviewBusy} onClick={() => startReview(item, 'Approved')}><CheckCircle2 size={14} aria-hidden="true"/>Approve</button>
            </div>}
          </article>;
        })}</div> : <div className="sl-notification-empty sl-notification-caught-up" role="status"><Check size={20} aria-hidden="true"/><strong>You’re all caught up</strong><p>There are no unread notifications.</p></div>}
        {filteredItems.length > 5 && <button type="button" className="sl-notification-see-all" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show less' : 'See all'}</button>}
      </>
        : loading ? <div className="sl-notification-empty" role="status"><Bell size={24} aria-hidden="true"/><strong>Checking for notifications</strong><p>Recent activity will appear here.</p></div>
        : failedSources.length > 0 || loadError ? <div className="sl-notification-empty" role="alert"><Bell size={24} aria-hidden="true"/><strong>Could not load notifications</strong><p>Check your connection and retry.</p><button type="button" className="sl-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} aria-hidden="true"/> Retry</button></div>
        : <div className="sl-notification-empty"><Bell size={24} aria-hidden="true"/><strong>No notifications yet</strong><p>System alerts, account activity, and change-request updates will appear here when they are generated.</p></div>}
    </section>}
    <Dialog
      open={!!reviewTarget}
      title={`${reviewTarget?.decision ?? 'Review'} request`}
      onDismiss={() => { if (!reviewBusy) setReviewTarget(null); }}
      busy={reviewBusy}
      className="sl-notification-review-dialog"
      actions={<>
        <button type="button" className="sl-button" disabled={reviewBusy} onClick={() => setReviewTarget(null)}>Cancel</button>
        <button type="button" className={reviewTarget?.decision === 'Approved' ? 'sl-button sl-button-primary' : 'sl-button sl-notification-reject'} disabled={reviewBusy} onClick={() => void submitReview()}>
          {reviewBusy ? 'Saving…' : `${reviewTarget?.decision ?? 'Review'} request`}
        </button>
      </>}
    >
      {reviewTarget && <div className="sl-notification-review-content">
        <p>{reviewTarget.item.message}</p>
        {needsInitialPassword && <label>Initial password<input className="sl-admin-input" type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={reviewPassword} disabled={reviewBusy} onChange={event => { setReviewPassword(event.target.value); setReviewError(''); }} /><small>At least 12 non-whitespace characters are required to create the account.</small></label>}
        {needsReviewNote && <label>Review note<textarea className="sl-admin-input" rows={3} maxLength={500} value={reviewNote} disabled={reviewBusy} onChange={event => { setReviewNote(event.target.value); setReviewError(''); }} /><small>A review note is required when rejecting a change request.</small></label>}
        {reviewError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{reviewError}</p>}
      </div>}
    </Dialog>
  </div>;
}
