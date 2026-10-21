import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, Clock3, Package, RefreshCw } from 'lucide-react';
import { currentUser } from '../../services/auth';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary } from '../../services/inventory-batches';
import { formatDate, formatDateTime } from '../../utils/date-time';
import { useRouter } from '../../routing/navigation';
import { DataState, PageHeader } from './primitives';

type AlertFilter = 'all' | 'unread';
type InventoryAlert = { id: string; batch: InventoryBatch; status: Exclude<InventoryBatchDisplayStatus, 'In Stock' | 'No Stock'>; severity: 'critical' | 'attention'; read: boolean };
const READ_KEY = 'shelflifeai.inventory-alerts';
const alertStatuses: Array<Exclude<InventoryBatchDisplayStatus, 'In Stock' | 'No Stock'>> = ['Expired', 'Near Expiry', 'Low Stock'];

function loadReadIds(key: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch { return new Set<string>(); }
}

export function ConnectedManagerAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [summary, setSummary] = useState<InventoryBatchSummary | null>(null);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [readKey, setReadKey] = useState(READ_KEY);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const user = await currentUser();
      const key = `${READ_KEY}.${user.id}`;
      setReadKey(key);
      const [nextSummary, ...pages] = await Promise.all([
        getInventoryBatchSummary(signal),
        ...alertStatuses.map(status => listInventoryBatches({ page: 1, pageSize: 100, status, sort: status === 'Near Expiry' || status === 'Expired' ? 'fefo' : 'ingredient' }, signal)),
      ]);
      if (signal?.aborted) return;
      const readIds = loadReadIds(key);
      const nextAlerts = pages.flatMap(page => page.items).map(batch => {
        const status = batch.displayStatus as Exclude<InventoryBatchDisplayStatus, 'In Stock' | 'No Stock'>;
        const id = `${status}:${batch.id}`;
        return { id, batch, status, severity: status === 'Expired' ? 'critical' as const : 'attention' as const, read: readIds.has(id) };
      }).sort((a, b) => {
        const priority = { Expired: 0, 'Near Expiry': 1, 'Low Stock': 2 };
        return priority[a.status] - priority[b.status] || (a.batch.daysLeft - b.batch.daysLeft) || a.batch.ingredient.name.localeCompare(b.batch.ingredient.name);
      });
      setSummary(nextSummary);
      setAlerts(nextAlerts);
      setFailed(false);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setFailed(true);
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const unread = alerts.filter(alert => !alert.read).length;
  const visibleAlerts = filter === 'unread' ? alerts.filter(alert => !alert.read) : alerts;
  const save = (next: InventoryAlert[]) => {
    setAlerts(next);
    try { localStorage.setItem(readKey, JSON.stringify(next.filter(item => item.read).map(item => item.id))); } catch { /* Storage is optional. */ }
  };
  const markAllRead = () => save(alerts.map(alert => ({ ...alert, read: true })));
  const markRead = (id: string) => save(alerts.map(alert => alert.id === id ? { ...alert, read: true } : alert));

  return <>
    <PageHeader eyebrow="Intelligence" title="Alerts" description="Review expired, expiring, and low-stock inventory that needs attention." />
    <div className="sl-admin-view sl-manager-alerts-page">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Inventory alert summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Bell /></span><div><span>Total alerts</span><strong>{failed ? '—' : summary ? summary.expiredItems + summary.nearExpiry + summary.lowStockItems : '—'}</strong><small>Current stock alerts</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Expired batches</span><strong>{failed ? '—' : summary?.expiredItems ?? '—'}</strong><small>Needs action now</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Package /></span><div><span>Low-stock ingredients</span><strong>{failed ? '—' : summary?.lowStockItems ?? '—'}</strong><small>Below minimum stock</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Expiring soon</span><strong>{failed ? '—' : summary?.nearExpiry ?? '—'}</strong><small>Within 7 days</small></div></article>
      </section>
      <section className="sl-manager-alerts-card" aria-labelledby="sl-manager-alerts-title">
        <header className="sl-manager-alerts-header"><div><h2 id="sl-manager-alerts-title">Inventory alerts</h2><p>{unread ? `${unread} unread` : 'You’re up to date'}</p></div><div className="sl-manager-alerts-actions"><button type="button" className="sl-button" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={15} aria-hidden="true" />Refresh</button><button type="button" className="sl-button" onClick={markAllRead} disabled={!unread}><CheckCheck size={15} aria-hidden="true" />Mark all as read</button></div></header>
        <div className="sl-manager-alerts-tabs" role="tablist" aria-label="Alert filter"><button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All <span>{alerts.length}</span></button><button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Unread <span>{unread}</span></button></div>
        {failed ? <DataState kind="error" title="Alerts unavailable" description="Inventory alert data could not be loaded. Refresh to try again." />
          : loading ? <DataState kind="loading" title="Loading alerts" description="Checking current inventory conditions." />
            : visibleAlerts.length === 0 ? <DataState kind="empty" title={filter === 'unread' ? 'No unread alerts' : 'No inventory alerts'} description={filter === 'unread' ? 'You have reviewed all current inventory alerts.' : 'No batches are expired, near expiry, or below minimum stock.'} />
              : <div className="sl-manager-alerts-list">{visibleAlerts.map(alert => <article key={alert.id} className="sl-manager-alert-row" data-read={alert.read} data-severity={alert.severity}>
                <span className="sl-manager-alert-icon"><AlertTriangle size={17} aria-hidden="true" /></span>
                <div className="sl-manager-alert-copy"><strong>{alert.status === 'Expired' ? 'Expired batch needs attention' : alert.status === 'Near Expiry' ? 'Batch expiring soon' : 'Ingredient is low on stock'}</strong><span>{alert.batch.ingredient.name} · {alert.batch.batchID} · {alert.batch.quantity.toLocaleString('en-PH')} {alert.batch.unit}</span><small>{alert.status === 'Expired' ? `Expired ${formatDate(alert.batch.expirationDate)}` : alert.status === 'Near Expiry' ? `Expires ${formatDate(alert.batch.expirationDate)} · ${Math.max(0, alert.batch.daysLeft)} days left` : `Minimum stock: ${alert.batch.ingredient.minimumStock?.toLocaleString('en-PH') ?? 'configured'}`}</small></div>
                <div className="sl-manager-alert-row-actions"><span className="sl-manager-alert-severity">{alert.status}</span><button type="button" className="sl-button" onClick={() => { markRead(alert.id); router.push('/Inventory'); }}>View inventory</button>{!alert.read && <button type="button" className="sl-button sl-manager-alert-read" onClick={() => markRead(alert.id)}>Mark read</button>}</div>
                <time dateTime={alert.batch.updatedAt}>{formatDateTime(alert.batch.updatedAt)}</time>
              </article>)}</div>}
      </section>
    </div>
  </>;
}
