import { Link } from 'expo-router';
import { AlertTriangle, ArrowRight, Box, CalendarClock, FileText, Target, Trash2, UsersRound, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type Account, type AuditRecord, type DashboardSummary } from '../../services/administration';
import { sessionDisplayName, type SessionUser } from '../../services/auth';
import { Card, Status, PageHeader} from '../application/primitives';
import { formatTime } from '../../utils/date-time';

const AUTO_REFRESH_MS = 15000;
const roleOrder = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;

function ChartCardTitle({ Icon, children }: { Icon: LucideIcon; children: string }) {
  return <span className="sl-dashboard-card-heading"><span className="sl-staff-usage-head-icon"><Icon aria-hidden="true" /></span><span>{children}</span></span>;
}

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

  const backendRoleDistribution = summary?.roleCounts
    ? roleOrder.map(role => ({ role, count: summary.roleCounts?.[role] ?? null }))
    : null;
  const dashboardRoleDistribution = roleOrder.map(role => ({
    role,
    count: backendRoleDistribution?.find(item => item.role === role)?.count ?? null,
  }));
  const distributionTotal = backendRoleDistribution?.reduce((sum, item) => sum + (item.count ?? 0), 0) ?? 0;
  const distributionStops = dashboardRoleDistribution.reduce<{ cursor: number; stops: string[] }>((state, item, index) => {
    const palette = ['#0b8755', '#79c9a3', '#ffd166', '#67a98f'];
    if (!distributionTotal || item.count === null) return state;
    const next = state.cursor + (item.count / distributionTotal) * 100;
    state.stops.push(`${palette[index]} ${state.cursor}% ${next}%`);
    state.cursor = next;
    return state;
  }, { cursor: 0, stops: [] });
  const distributionBackground = distributionTotal && distributionStops.stops.length
    ? `radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(${distributionStops.stops.join(',')})`
    : 'radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(#e9eef3 0 100%)';

  const totalUsers = summary?.totalUsers ?? accountsTotal;
  return <div className="sl-admin-view sl-superadmin-dashboard sl-superadmin-dashboard-v49 sl-staff-usage-v150 sl-superadmin-users-page-v60 sl-superadmin-users-page-v63 sl-superadmin-users-page-v64">
    <div className="sl-dashboard-heading sl-dashboard-heading-v8 sl-superadmin-dashboard-heading">
      <PageHeader eyebrow="Dashboard" title={`${greeting}, ${sessionDisplayName(user)}.`} />
      <p className="sl-dashboard-description">Monitor system-wide activity, security, operations and administrative oversight.</p>
    </div>
    <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="System overview">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Total Users</span><strong>{totalUsers?.toLocaleString() ?? (summaryError && accountsError ? 'Unavailable' : 'Loading…')}</strong><small>System-wide accounts</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Active Accounts</span><strong>{summary?.activeUsers.toLocaleString() ?? (summaryError ? 'Unavailable' : 'Loading…')}</strong><small>{summary ? `${summary.inactiveUsers.toLocaleString()} inactive` : 'Live account status'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Ingredients Tracked</span><strong>—</strong><small>Awaiting oversight API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Active Alerts</span><strong>—</strong><small>Awaiting alert summary API</small></div></article>
    </section>

    <section className="sl-sa-analytics-row sl-sa-analytics-row-v317">
      <Card id="sl-sa-expiration" title={<ChartCardTitle Icon={CalendarClock}>Expiration Status (All Ingredients)</ChartCardTitle>}>
        <div className="sl-sa-chart-surface sl-sa-expiration-donut-surface">
          <div className="sl-sa-expiration-donut" aria-hidden="true"><strong>—</strong><span>Batches</span></div>
          <div className="sl-sa-chart-legend" aria-label="Expiration status legend">
            <div><i className="is-good"/><span>Active</span><strong>—</strong></div>
            <div><i className="is-expiring"/><span>Expiring Soon</span><strong>—</strong></div>
            <div><i className="is-expired"/><span>Expired</span><strong>—</strong></div>
          </div>
          <span className="sl-sa-chart-empty-note">Expiration data unavailable</span>
        </div>
      </Card>
      <Card id="sl-sa-waste" title={<ChartCardTitle Icon={Trash2}>Waste Trend (Last 6 Months)</ChartCardTitle>}>
        <div className="sl-sa-chart-surface sl-sa-line-chart-surface" role="img" aria-label="Six-month waste quantity trend; live values unavailable">
          <span className="sl-sa-chart-y-title">Waste Quantity</span>
          <div className="sl-sa-chart-y-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <div className="sl-sa-line-chart-plot" aria-hidden="true"><svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M0 48 L100 48" /></svg></div>
          <div className="sl-sa-chart-x-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <span className="sl-sa-chart-x-title">Month</span>
          <span className="sl-sa-chart-empty-note">Waste trend unavailable</span>
        </div>
      </Card>
      <Card id="sl-sa-forecast" title={<ChartCardTitle Icon={Target}>Forecast Accuracy (Last 6 Months)</ChartCardTitle>}>
        <div className="sl-sa-chart-surface sl-sa-bar-chart-surface" role="img" aria-label="Six-month forecast accuracy percentage; live values unavailable">
          <span className="sl-sa-chart-y-title">Forecast Accuracy (%)</span>
          <div className="sl-sa-chart-y-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <div className="sl-sa-bar-chart-plot" aria-hidden="true">{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</div>
          <div className="sl-sa-chart-x-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
          <span className="sl-sa-chart-x-title">Month</span>
          <span className="sl-sa-chart-empty-note">Forecast accuracy unavailable</span>
        </div>
      </Card>
      <Card id="sl-sa-distribution" title={<ChartCardTitle Icon={UsersRound}>User Distribution</ChartCardTitle>}>
        <div className="sl-sa-chart-surface sl-sa-expiration-donut-surface sl-sa-user-distribution-surface">
          <div className="sl-sa-expiration-donut sl-sa-user-distribution-donut" style={{ background: distributionBackground }}>
            <strong>{backendRoleDistribution ? distributionTotal.toLocaleString() : '—'}</strong><span>Users</span>
          </div>
          <div className="sl-sa-chart-legend sl-sa-user-distribution-legend" aria-label="User distribution legend">
            {dashboardRoleDistribution.map(item => <div key={item.role}>
              <i data-role={item.role} />
              <span>{item.role}</span><strong>{item.count ?? '—'}</strong>
            </div>)}
          </div>
        </div>
      </Card>
    </section>

    <section className="sl-sa-middle-row sl-sa-dashboard-activity-row-v319">
      <section id="sl-sa-expiring-items" className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="sl-sa-expiring-items-title">
        <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
          <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
          <h2 id="sl-sa-expiring-items-title">Critical / Expiring Ingredients</h2>
          <div className="sl-staff-usage-head-actions"><Link href="/ExpirationMonitoring" className="sl-staff-usage-viewall sl-v209-viewall-button">View All <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </header>
        <div className="sl-staff-usage-table-shell">
          <table className="sl-data-table sl-staff-usage-table sl-sa-expiring-table"><thead><tr><th>Ingredient</th><th>Batch</th><th>Expiry Date</th><th>Status</th></tr></thead><tbody><tr className="sl-sa-dashboard-empty-data-row" aria-label="No expiration records available"><td>—</td><td>—</td><td>—</td><td>—</td></tr></tbody></table>
        </div>
      </section>
      <section id="sl-sa-recent-activity" className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="sl-sa-recent-activity-title">
        <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
          <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
          <h2 id="sl-sa-recent-activity-title">Recent System Activity</h2>
          <div className="sl-staff-usage-head-actions"><Link href="/SecurityActivity" className="sl-staff-usage-viewall sl-v209-viewall-button">View All <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </header>
        <div className="sl-staff-usage-table-shell">
          <table className="sl-data-table sl-staff-usage-table sl-sa-expiring-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{audit?.items.length ? audit.items.map(row => <tr key={row.id}><td>{formatTime(row.timestamp)}</td><td>{row.actor.name}<small>{row.actor.role}</small></td><td>{row.action.replaceAll('_',' ')}</td><td>{row.targetType}<small>{row.targetId}</small></td></tr>) : <tr className="sl-sa-dashboard-empty-data-row" aria-label={auditError ? 'System activity unavailable' : !audit ? 'System activity loading' : 'No system activity recorded'}><td>—</td><td>—</td><td>—</td><td>—</td></tr>}</tbody></table>
        </div>
      </section>
    </section>
  </div>;
}
