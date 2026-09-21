import { Link } from 'expo-router';
import { AlertTriangle, ArrowRight, Box, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type Account, type AuditRecord, type DashboardSummary } from '../../services/administration';
import type { SessionUser } from '../../services/auth';
import { Card, DataState, Status, PageHeader} from '../application/primitives';

const AUTO_REFRESH_MS = 15000;
const roleOrder = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;


export default function SuperAdminDashboard({ user }: { user: SessionUser }) {
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    };
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsTotal, setAccountsTotal] = useState<number | null>(null);
  const [accountsError, setAccountsError] = useState(false);
  const [audit, setAudit] = useState<{ items: AuditRecord[]; total: number } | null>(null);
  const [auditError, setAuditError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setSummaryError(false); setAccountsError(false); setAuditError(false);
    Promise.allSettled([
      dashboardSummary(abort.signal),
      listAccounts(1, 'createdAt', 'desc', abort.signal),
      listAuditRecords(1, 5, 'desc', {}, abort.signal),
    ]).then(([summaryResult, accountsResult, auditResult]) => {
      if (abort.signal.aborted) return;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value); else setSummaryError(true);
      if (accountsResult.status === 'fulfilled') {
        setAccounts(accountsResult.value.items);
        setAccountsTotal(accountsResult.value.total);
      } else { setAccounts([]); setAccountsTotal(null); setAccountsError(true); }
      if (auditResult.status === 'fulfilled') setAudit({ items: auditResult.value.items, total: auditResult.value.total });
      else { setAudit(null); setAuditError(true); }
    });
    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const completeRoleDistribution = useMemo(() => {
    if (accountsTotal === null || accounts.length !== accountsTotal) return null;
    return roleOrder.map(role => ({ role, count: accounts.filter(account => account.role === role).length }));
  }, [accounts, accountsTotal]);
  const dashboardRoleDistribution = roleOrder.map(role => ({
    role,
    count: completeRoleDistribution?.find(item => item.role === role)?.count ?? null,
  }));
  const distributionTotal = completeRoleDistribution?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const distributionStops = dashboardRoleDistribution.reduce<{ cursor: number; stops: string[] }>((state, item, index) => {
    const palette = ['#0b8755', '#79c9a3', '#ffd166', '#67a98f'];
    const next = state.cursor + (distributionTotal && item.count !== null ? (item.count / distributionTotal) * 100 : 25);
    state.stops.push(`${palette[index]} ${state.cursor}% ${next}%`);
    state.cursor = next;
    return state;
  }, { cursor: 0, stops: [] });
  const distributionBackground = distributionTotal
    ? `radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(${distributionStops.stops.join(',')})`
    : 'radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(#e9eef3 0 100%)';

  const totalUsers = summary?.totalUsers ?? accountsTotal;
  return <div className="sl-admin-view sl-superadmin-dashboard sl-superadmin-dashboard-v49 sl-staff-usage-v150 sl-superadmin-users-page-v60 sl-superadmin-users-page-v63 sl-superadmin-users-page-v64">
    <div className="sl-dashboard-heading sl-dashboard-heading-v8 sl-superadmin-dashboard-heading">
      <PageHeader eyebrow="Dashboard" title={`${greeting}, ${user.firstName || 'Super Admin'}.`} />
      <p className="sl-dashboard-description">Monitor system-wide activity, security, operations and administrative oversight.</p>
    </div>
    <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="System overview">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Total Users</span><strong>{totalUsers?.toLocaleString() ?? (summaryError && accountsError ? 'Unavailable' : 'Loading…')}</strong><small>System-wide accounts</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Active Accounts</span><strong>{summary?.activeUsers.toLocaleString() ?? (summaryError ? 'Unavailable' : 'Loading…')}</strong><small>{summary ? `${summary.inactiveUsers.toLocaleString()} inactive` : 'Live account status'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Ingredients Tracked</span><strong>—</strong><small>Awaiting oversight API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Active Alerts</span><strong>—</strong><small>Awaiting alert summary API</small></div></article>
    </section>

    <section className="sl-sa-analytics-row sl-sa-analytics-row-v317">
      <Card id="sl-sa-expiration" title="Expiration Status (All Ingredients)">
        <div className="sl-sa-chart-surface sl-sa-expiration-donut-surface">
          <div className="sl-sa-expiration-donut" aria-hidden="true"><strong>—</strong><span>Batches</span></div>
          <div className="sl-sa-chart-legend" aria-label="Expiration status legend">
            <div><i className="is-good"/><span>Good Shelf Life</span><strong>—</strong></div>
            <div><i className="is-expiring"/><span>Expiring</span><strong>—</strong></div>
            <div><i className="is-expired"/><span>Expired</span><strong>—</strong></div>
          </div>
          <span className="sl-sa-chart-empty-note">No live records yet</span>
        </div>
      </Card>
      <Card id="sl-sa-waste" title="Waste Trend (Last 6 Months)">
        <div className="sl-sa-chart-surface sl-sa-line-chart-surface" aria-label="Waste trend line chart">
          <div className="sl-sa-chart-y-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <div className="sl-sa-line-chart-plot" aria-hidden="true"><svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M0 48 L100 48" /></svg></div>
          <div className="sl-sa-chart-x-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <span className="sl-sa-chart-empty-note">No live records yet</span>
        </div>
      </Card>
      <Card id="sl-sa-forecast" title="Forecast Accuracy (Last 6 Months)">
        <div className="sl-sa-chart-surface sl-sa-bar-chart-surface" aria-label="Forecast accuracy bar chart">
          <div className="sl-sa-chart-y-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <div className="sl-sa-bar-chart-plot" aria-hidden="true">{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</div>
          <div className="sl-sa-chart-x-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <span className="sl-sa-chart-empty-note">No live records yet</span>
        </div>
      </Card>
      <section id="sl-sa-distribution" className="sl-v56-side-card sl-sa-dashboard-distribution-card">
        <h2>User Distribution</h2>
        <div className="sl-v56-distribution">
          <div className="sl-v56-donut" style={{ background: distributionBackground }}>
            <strong>{completeRoleDistribution ? accountsTotal : '—'}</strong><span>Users</span>
          </div>
          <div className="sl-v56-legend">
            {dashboardRoleDistribution.map(item => <div key={item.role}>
              <span className="sl-v56-dot" data-role={item.role} />
              <span>{item.role}</span><strong>{item.count ?? '—'}</strong>
            </div>)}
          </div>
        </div>
      </section>
    </section>

    <section className="sl-sa-middle-row">
      <Card id="sl-sa-expiring-items" title="Critical / Expiring Items" action={<Link href="/ExpirationMonitoring" className="sl-text-link">View all <ArrowRight size={14}/></Link>}>
        <div className="sl-table-scroll"><table className="sl-data-table sl-sa-expiring-table"><thead><tr><th>Ingredient</th><th>Batch</th><th>Expiry Date</th><th>Status</th></tr></thead><tbody><tr><td colSpan={4} className="sl-empty-cell"><DataState kind="empty" title="No live records yet" description="Expiration / FEFO records" /></td></tr></tbody></table></div>
      </Card>
      <Card id="sl-sa-recent-activity" title="Recent System Activity" action={<Link href="/SecurityActivity" className="sl-text-link">View all <ArrowRight size={14}/></Link>}>
        <div className="sl-table-scroll"><table className="sl-data-table sl-sa-activity-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{auditError ? <tr><td colSpan={4} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check connectivity and try again." /></td></tr> : !audit ? <tr><td colSpan={4} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="" /></td></tr> : audit.items.length === 0 ? <tr><td colSpan={4} className="sl-empty-cell"><DataState kind="empty" title="No system activity recorded yet" description="Recorded system activity will appear here." /></td></tr> : audit.items.map(row => <tr key={row.id}><td>{new Date(row.timestamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true})}</td><td>{row.actor.name}<small>{row.actor.role}</small></td><td>{row.action.replaceAll('_',' ')}</td><td>{row.targetType}<small>{row.targetId}</small></td></tr>)}</tbody></table></div>
      </Card>
    </section>
  </div>;
}
