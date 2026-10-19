import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Check, ArrowUpRight, Shield, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '../../utils/date-time';
import { currentUser } from '../../services/auth';
import { apiClient } from '../../services/apiClient';
import { approveChangeRequest, rejectChangeRequest } from '../../services/change-requests';
import { listInventoryBatches, getInventoryBatchSummary } from '../../services/inventory-batches';
import { listAuditRecords } from '../../services/administration';
import { useRouter } from '../../routing/navigation';

import { parseNotifications, type NotificationItem } from '../../utils/notifications';
export { parseNotifications, type NotificationItem };

type ChangeRequest = { id: string; requestID: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; ingredient?: { name: string }; requestType: string; updatedAt: string; createdAt: string };
type RequestPage = { items: ChangeRequest[] };
type StockPage = Awaited<ReturnType<typeof listInventoryBatches>>;
const STORAGE_KEY = 'shelflifeai.notifications';

function loadNotifications(key: string): NotificationItem[] {
  try { return parseNotifications(localStorage.getItem(key)); }
  catch { return []; }
}

function requestNotification(row: ChangeRequest, role: string): NotificationItem {
  const ingredient = row.ingredient?.name || 'an ingredient';
  const date = row.updatedAt || row.createdAt;
  if (role === 'Manager') return {
    id: `${row.id}:${row.status}:${date}`,
    kind: 'request',
    title: row.status === 'PENDING' ? `${row.requestID} needs review` : `${row.requestID} ${row.status.toLowerCase()}`,
    message: row.status === 'PENDING' ? `${ingredient} · awaiting your decision` : `${ingredient} · ${row.status.toLowerCase()}`,
    timestamp: date,
    read: false,
  };
  return {
    id: `${row.id}:${row.status}:${date}`,
    kind: 'request',
    title: `${row.requestID} ${row.status.toLowerCase()}`,
    message: `${ingredient} · your request was ${row.status.toLowerCase()}`,
    timestamp: date,
    read: false,
  };
}

export function Notifications({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [storageKey, setStorageKey] = useState(STORAGE_KEY);
  const [role, setRole] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'requests' | 'stock' | 'security' | 'system'>('all');

  const refresh = useCallback(async () => {
    try {
      const user = await currentUser();
      setRole(user.role);
      const key = `${STORAGE_KEY}.${user.id}`;
      setStorageKey(key);
      const previous = loadNotifications(key);
      const readIds = new Set(previous.filter(item => item.read).map(item => item.id));

      if (user.role === 'Super Admin') {
        const [auditPage, batchSummary] = await Promise.all([
          listAuditRecords(1, 25, 'desc').catch(() => ({ items: [], page: 1, pageSize: 25, total: 0 })),
          getInventoryBatchSummary().catch(() => null),
        ]);

        const adminItems: NotificationItem[] = [];

        for (const record of auditPage.items) {
          const timestamp = record.timestamp;
          if (!timestamp || !Number.isFinite(Date.parse(timestamp))) continue;

          let title = '';
          let message = '';
          let kind: 'security' | 'system' = 'system';
          let targetPath = '/AdministrativeAudit';

          if (record.action === 'CREATE' && record.targetType === 'User') {
            title = 'New user account created';
            message = `${record.actor.name} (${record.actor.role}) created ${record.targetName || 'user account'}`;
            kind = 'system';
            targetPath = '/UserManagement';
          } else if (record.action === 'DEACTIVATE' || record.action === 'REACTIVATE') {
            title = `Account ${record.action === 'DEACTIVATE' ? 'deactivated' : 'reactivated'}`;
            message = `${record.actor.name} ${record.action.toLowerCase()}d ${record.targetName || 'user account'}`;
            kind = 'security';
            targetPath = '/UserManagement';
          } else if (record.action === 'UPDATE' && record.targetType === 'User') {
            title = 'User account updated';
            message = record.details || record.detailsDisplay || `${record.actor.name} updated account`;
            kind = 'system';
            targetPath = '/UserManagement';
          } else if (record.status === 'Failed' || record.status === 'Warning') {
            title = `Security alert: ${record.action}`;
            message = record.details || record.detailsDisplay || `${record.actor.name} triggered a ${record.status.toLowerCase()} event`;
            kind = 'security';
            targetPath = '/AdministrativeAudit';
          } else if (record.action === 'LOGIN' && record.actor.id !== user.id) {
            title = 'Administrator sign-in';
            message = `${record.actor.name} (${record.actor.role}) signed in`;
            kind = 'security';
            targetPath = '/SecurityActivity';
          } else if (record.action === 'CREATE' || record.action === 'UPDATE' || record.action === 'DELETE') {
            title = `${record.targetType || 'System'} ${record.action.toLowerCase()}`;
            message = record.details || record.detailsDisplay || `${record.actor.name} performed ${record.action.toLowerCase()} on ${record.targetName || record.targetType}`;
            kind = 'system';
            targetPath = '/AdministrativeAudit';
          }

          if (title && message) {
            adminItems.push({
              id: `audit:${record.id}`,
              title,
              message,
              timestamp,
              read: readIds.has(`audit:${record.id}`),
              kind,
              targetPath,
            });
          }
        }

        if (batchSummary) {
          const nowIso = new Date().toISOString();
          if (batchSummary.expiredItems > 0) {
            const alertId = `system:expired:${batchSummary.expiredItems}`;
            const existing = previous.find(p => p.id === alertId);
            adminItems.push({
              id: alertId,
              title: 'Critical: Expired inventory items',
              message: `${batchSummary.expiredItems} expired batch${batchSummary.expiredItems > 1 ? 'es require' : ' requires'} immediate disposal`,
              timestamp: existing?.timestamp || nowIso,
              read: readIds.has(alertId),
              kind: 'system',
              targetPath: '/Alerts',
            });
          }
          if (batchSummary.nearExpiry > 0) {
            const alertId = `system:near-expiry:${batchSummary.nearExpiry}`;
            const existing = previous.find(p => p.id === alertId);
            adminItems.push({
              id: alertId,
              title: 'Urgent: Batches near expiry',
              message: `${batchSummary.nearExpiry} batch${batchSummary.nearExpiry > 1 ? 'es are' : ' is'} nearing expiration within 7 days`,
              timestamp: existing?.timestamp || nowIso,
              read: readIds.has(alertId),
              kind: 'system',
              targetPath: '/Alerts',
            });
          }
          if (batchSummary.lowStockItems > 0) {
            const alertId = `system:low-stock:${batchSummary.lowStockItems}`;
            const existing = previous.find(p => p.id === alertId);
            adminItems.push({
              id: alertId,
              title: 'Alert: Low stock threshold reached',
              message: `${batchSummary.lowStockItems} ingredient${batchSummary.lowStockItems > 1 ? 's are' : ' is'} below minimum stock level`,
              timestamp: existing?.timestamp || nowIso,
              read: readIds.has(alertId),
              kind: 'system',
              targetPath: '/Alerts',
            });
          }
        }

        const next = adminItems
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
          .slice(0, 30);
        setItems(next);
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional. */ }
        return;
      }

      const requestPagePromise: Promise<RequestPage> = user.role === 'Manager' || user.role === 'Inventory Staff'
        ? apiClient<RequestPage>(`/change-requests${user.role === 'Manager' ? '?status=PENDING&pageSize=100' : '?pageSize=100'}`)
        : Promise.resolve({ items: [] });
      const stockPagePromise: Promise<StockPage> = user.role === 'Manager' || user.role === 'Admin'
        ? listInventoryBatches({ page: 1, pageSize: 100, sort: 'latest' })
        : Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
      const [page, stockPage] = await Promise.all([requestPagePromise, stockPagePromise]);
      const checkKey = `${key}.stock-check`;
      const lastStockCheck = Number(localStorage.getItem(checkKey) || 0);
      const checkedAt = Date.now();
      const newStockItems = stockPage.items
        .filter(batch => lastStockCheck > 0 && Date.parse(batch.createdAt) > lastStockCheck)
        .map(batch => ({
          id: `stock:${batch.id}`,
          kind: 'stock' as const,
          title: 'New stock received',
          message: `${batch.ingredient.name} · ${batch.quantity.toLocaleString()} ${batch.unit} · ${batch.batchID}`,
          timestamp: batch.createdAt,
          read: readIds.has(`stock:${batch.id}`),
          batchId: batch.id,
        }));
      try { localStorage.setItem(checkKey, String(checkedAt)); } catch { /* Storage is optional. */ }
      const requestItems = page.items
        .filter(row => user.role === 'Manager' || row.status !== 'PENDING')
        .map(row => ({ ...requestNotification(row, user.role), requestId: row.id, status: row.status, read: readIds.has(`${row.id}:${row.status}:${row.updatedAt || row.createdAt}`) }));
      const currentNotificationIds = new Set([...requestItems, ...newStockItems].map(item => item.id));
      const priorStockItems = previous.filter(item => item.kind === 'stock' && !currentNotificationIds.has(item.id));
      const next = [...requestItems, ...newStockItems, ...priorStockItems]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 30);
      setItems(next);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    } catch {
      // Keep the last successful notification list available during temporary API outages.
      setItems(current => current.length ? current : loadNotifications(storageKey));
    }
  }, [storageKey]);

  useEffect(() => {
    void refresh();
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refresh();
    };
    const interval = window.setInterval(tick, 30_000);
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    void refresh();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) onChange(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { onChange(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, onChange, refresh]);

  const unread = items.filter(item => !item.read).length;
  const requests = items.filter(item => item.kind === 'request');
  const stockItems = items.filter(item => item.kind === 'stock');
  const securityItems = items.filter(item => item.kind === 'security');
  const systemItems = items.filter(item => item.kind === 'system');
  const visibleItems = filter === 'unread' ? items.filter(item => !item.read)
    : filter === 'requests' ? requests
    : filter === 'stock' ? stockItems
    : filter === 'security' ? securityItems
    : filter === 'system' ? systemItems
    : items;

  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!icon) return;
    const originalHref = icon.dataset.originalHref || icon.getAttribute('href') || '/icons/shelflife-logo.svg';
    icon.dataset.originalHref = originalHref;
    if (!unread) { icon.href = originalHref; return; }

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, 32, 32);
        context.beginPath();
        context.arc(25, 7, 6, 0, Math.PI * 2);
        context.fillStyle = '#ed174c';
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = '#ffffff';
        context.stroke();
        icon.href = canvas.toDataURL('image/png');
      } catch { /* Keep the original favicon if canvas rendering is unavailable. */ }
    };
    image.src = new URL(originalHref, window.location.href).href;
    return () => { image.onload = null; };
  }, [unread]);

  const markAllRead = () => {
    const next = items.map(item => ({ ...item, read: true }));
    setItems(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  };

  const openNotification = (item: NotificationItem) => {
    const next = items.map(row => row.id === item.id ? { ...row, read: true } : row);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    setItems(next);
    onChange(false);
    if (item.targetPath) {
      router.push(item.targetPath);
    } else if (item.requestId || item.batchId) {
      router.push(item.kind === 'stock' ? '/Inventory' : role === 'Manager' ? '/ChangeRequests' : '/MyRequests');
    }
  };

  const review = async (item: NotificationItem, decision: 'approve' | 'reject') => {
    if (!item.requestId || busyId) return;
    if (decision === 'reject' && !rejectNote.trim()) { setActionError('Add a reason before rejecting this request.'); return; }
    setBusyId(item.id); setActionError('');
    try {
      if (decision === 'approve') await approveChangeRequest(item.requestId);
      else await rejectChangeRequest(item.requestId, rejectNote.trim());
      setRejectingId(''); setRejectNote('');
      await refresh();
    } catch {
      setActionError(decision === 'approve' ? 'Could not approve this request. Try again.' : 'Could not reject this request. Try again.');
    } finally { setBusyId(''); }
  };

  return <div className="sl-notifications" ref={container}>
    <button ref={trigger} className="sl-button sl-icon-button sl-notification-trigger" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
      <Bell size={20} aria-hidden="true" />{unread > 0 && <span className="sl-notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section id="sl-notifications-panel" className="sl-notification-panel" role="dialog" aria-labelledby="sl-notifications-title">
      <div className="sl-notification-header"><div><h2 id="sl-notifications-title">Notifications</h2></div></div>
      <div className="sl-notification-tabs" role="tablist" aria-label="Notification filter">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
          All
        </button>
        <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>
          Unread <small>{unread > 9 ? '9+' : unread}</small>
        </button>
        {role === 'Super Admin' ? <>
          <button type="button" role="tab" aria-selected={filter === 'security'} className={filter === 'security' ? 'is-active' : ''} onClick={() => setFilter('security')}>
            Security <small>{securityItems.length > 9 ? '9+' : securityItems.length}</small>
          </button>
          <button type="button" role="tab" aria-selected={filter === 'system'} className={filter === 'system' ? 'is-active' : ''} onClick={() => setFilter('system')}>
            System <small>{systemItems.length > 9 ? '9+' : systemItems.length}</small>
          </button>
        </> : <>
          <button type="button" role="tab" aria-selected={filter === 'requests'} className={filter === 'requests' ? 'is-active' : ''} onClick={() => setFilter('requests')}>
            Requests <small>{requests.length > 9 ? '9+' : requests.length}</small>
          </button>
          <button type="button" role="tab" aria-selected={filter === 'stock'} className={filter === 'stock' ? 'is-active' : ''} onClick={() => setFilter('stock')}>
            Stock <small>{stockItems.length > 9 ? '9+' : stockItems.length}</small>
          </button>
        </>}
      </div>
      {actionError && <p className="sl-notification-error" role="alert">{actionError}</p>}
      {visibleItems.length > 0 && <div className="sl-notification-section-heading">
        <strong>
          {filter === 'requests' ? 'Requests'
            : filter === 'stock' ? 'New stock'
            : filter === 'security' ? 'Security & Access'
            : filter === 'system' ? 'System & Alerts'
            : role === 'Super Admin' ? 'Recent system notifications'
            : role === 'Manager' ? 'Recent notifications'
            : 'Recent updates'}
        </strong>
        {filter !== 'all' && filter !== 'unread' && <button type="button" onClick={() => {
          onChange(false);
          if (role === 'Super Admin') {
            router.push(filter === 'security' ? '/SecurityActivity' : '/Alerts');
          } else {
            router.push(filter === 'stock' ? '/Inventory' : role === 'Manager' ? '/ChangeRequests' : '/MyRequests');
          }
        }}>View all</button>}
      </div>}
      {visibleItems.length ? <div className="sl-notification-list">{visibleItems.map(item => <article key={item.id} className="sl-notification-item" data-read={item.read}>
        <button type="button" className="sl-notification-open" onClick={() => openNotification(item)}>
          <span className="sl-notification-avatar" aria-hidden="true">
            {item.kind === 'security' ? <Shield size={15} /> : item.kind === 'system' ? <AlertTriangle size={15} /> : <Bell size={15}/>}
          </span>
          <span className="sl-notification-dot" aria-hidden="true"/>
          <span className="sl-notification-copy">
            <strong>{item.title}</strong>
            <span>{item.message}</span>
            <time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time>
          </span>
          <ArrowUpRight size={15} aria-hidden="true"/>
        </button>
        {item.kind === 'request' && role === 'Manager' && item.status === 'PENDING' && <div className="sl-notification-review">
          {rejectingId === item.id ? <><label><span>Reason for rejection</span><textarea value={rejectNote} onChange={event => setRejectNote(event.target.value)} rows={2} maxLength={500} /></label><button type="button" className="sl-button" disabled={!!busyId} onClick={() => { setRejectingId(''); setRejectNote(''); setActionError(''); }}>Cancel</button><button type="button" className="sl-button sl-button-danger" disabled={!!busyId || !rejectNote.trim()} onClick={() => void review(item, 'reject')}>{busyId === item.id ? 'Rejecting…' : 'Confirm reject'}</button></> : <><button type="button" className="sl-button sl-notification-review-choice" disabled={!!busyId} onClick={() => { setRejectingId(item.id); setRejectNote(''); setActionError(''); }}>Reject</button><button type="button" className="sl-button sl-button-primary sl-notification-review-choice" disabled={!!busyId} onClick={() => void review(item, 'approve')}><Check size={15}/>{busyId === item.id ? 'Approving…' : 'Approve'}</button></>}
        </div>}
      </article>)}</div> : <div className="sl-notification-empty">
        <Bell size={24} aria-hidden="true"/>
        <strong>
          {filter === 'unread' ? 'You’re all caught up'
            : filter === 'requests' ? 'No requests'
            : filter === 'stock' ? 'No stock notifications'
            : filter === 'security' ? 'No security notices'
            : filter === 'system' ? 'No system alerts'
            : 'No notifications yet'}
        </strong>
        <p>
          {filter === 'unread' ? (role === 'Super Admin' ? 'New security activity and system alerts will appear here.' : 'New change request activity and stock receipts will appear here.')
            : filter === 'requests' ? 'Change request approvals and updates will appear here.'
            : filter === 'stock' ? 'New Stock-In records will appear here.'
            : filter === 'security' ? 'User management and audit security events will appear here.'
            : filter === 'system' ? 'System health warnings and critical alerts will appear here.'
            : role === 'Super Admin' ? 'Administrative events, security logs, and critical inventory alerts will appear here.'
            : 'Change request reviews, approvals, and stock receipts will appear here when they are generated.'}
        </p>
      </div>}
      <footer className="sl-notification-footer"><button type="button" className="sl-button sl-notification-mark-read" disabled={!unread} onClick={markAllRead}><CheckCheck size={15}/>Mark all as read</button></footer>
    </section>}
  </div>;
}