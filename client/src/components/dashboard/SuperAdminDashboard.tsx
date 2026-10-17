import { Link } from '../../routing/navigation';
import { ArrowRight, FileText, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type DashboardSummary } from '../../services/administration';
import { sessionDisplayName, type SessionUser } from '../../services/auth';
import { buildAccountAnalytics } from '../../utils/account-analytics';
import { Card, PageHeader} from '../application/primitives';
import { AuditTable } from '../application/AuditTable';

const AUTO_REFRESH_MS = 15000;
function ChartCardTitle({ children }: { children: string }) {
  return <span className="sl-dashboard-card-heading"><span className="sl-sa-card-heading-copy"><span>{children}</span></span></span>;
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
  const [accountsTotal, setAccountsTotal] = useState<number | null>(null);
  const [accountsError, setAccountsError] = useState(false);
  // Only the count is needed here: the table body itself is the shared AuditTable, so
  // this fetch exists purely for the "Audit Events (Last 30 Days)" KPI.
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [auditError, setAuditError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setSummaryError(false); setAccountsError(false); setAuditError(false);
    Promise.allSettled([
      dashboardSummary(abort.signal),
      listAccounts(1, 'createdAt', 'desc', abort.signal),
      listAuditRecords(1, 1, 'desc', { from: new Date(Date.now() - 30 * 86400000).toISOString() }, abort.signal),
    ]).then(([summaryResult, accountsResult, auditResult]) => {
      if (abort.signal.aborted) return;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value); else setSummaryError(true);
      if (accountsResult.status === 'fulfilled') {
        setAccountsTotal(accountsResult.value.total);
      } else { setAccountsTotal(null); setAccountsError(true); }
      if (auditResult.status === 'fulfilled') setAuditCount(auditResult.value.total);
      else { setAuditCount(null); setAuditError(true); }
    });
    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const accountAnalytics = buildAccountAnalytics(summary);
  const distributionData = accountAnalytics.roles;

  const totalUsers = summary?.totalUsers ?? accountsTotal;
  const activeUsers = accountAnalytics.active;
  const inactiveUsers = accountAnalytics.inactive;
  const activePercent = summary && summary.totalUsers ? (summary.activeUsers / summary.totalUsers) * 100 : 0;
  const activePercentLabel = summary?.totalUsers ? Math.round(activePercent) : null;
  const summaryState = summary ? 'ready' : summaryError ? 'error' : 'loading';

  return <div className="sl-admin-view sl-superadmin-surface sl-superadmin-dashboard sl-superadmin-dashboard-v49 sl-staff-usage-v150 sl-superadmin-users-page-v60 sl-superadmin-users-page-v63 sl-superadmin-users-page-v64">
    <div className="sl-dashboard-heading sl-dashboard-heading-v8 sl-superadmin-dashboard-heading">
      <PageHeader eyebrow="Overview" title={`${greeting}, ${sessionDisplayName(user)}.`} />
      <p className="sl-dashboard-description">Manage accounts and review protected system activity.</p>
    </div>
    <section className="sl-sa-kpis sl-superadmin-kpis sl-superadmin-dashboard-kpis-v201" aria-label="System overview">
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Total Users</span><strong>{totalUsers?.toLocaleString() ?? (summaryError && accountsError ? 'Unavailable' : 'Loading…')}</strong><small>System-wide accounts</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Active Accounts</span><strong>{summary ? summary.activeUsers.toLocaleString() : summaryError ? 'Unavailable' : 'Loading…'}</strong><small>{activePercentLabel === null ? 'Live account status' : `▲ ${activePercentLabel}% active`}</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Inactive Accounts</span><strong>{summary ? summary.inactiveUsers.toLocaleString() : summaryError ? 'Unavailable' : 'Loading…'}</strong><small>{summary ? 'Deactivated accounts' : 'Account summary unavailable'}</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileText /></span><div><span>Audit Events (Last 30 Days)</span><strong>{auditCount !== null ? auditCount.toLocaleString() : auditError ? 'Unavailable' : 'Loading…'}</strong><small>{auditCount !== null ? 'Recorded in the last 30 days' : 'Audit summary unavailable'}</small></div></article>
    </section>

    <section className="sl-sa-analytics-row sl-sa-analytics-row-v317">
      <Card id="sl-sa-distribution" title={<ChartCardTitle>User Distribution</ChartCardTitle>}>
        <div className="sl-sa-distribution-content">
          <div className="sl-sa-distribution-bars" data-state={summaryState} aria-label="Account totals by role">
            {distributionData.map(item => (
              <div key={item.role} className="sl-sa-distribution-row">
                <div className="sl-sa-distribution-label">
                  <span>{item.role}</span>
                </div>
                <div className="sl-sa-progress-track" role="img" aria-label={summary ? `${item.role}: ${item.count} accounts, ${item.percentage}% of all accounts` : `${item.role}: account total unavailable`}>
                  <div className="sl-sa-progress-fill" style={{ width: `${item.barWidth}%`, backgroundColor: item.color }} />
                </div>
                <strong className="sl-sa-distribution-count">{summary ? item.count.toLocaleString() : '—'}</strong>
                <span className="sl-sa-distribution-percentage">{summary ? `${item.percentage}%` : '—'}</span>
              </div>
            ))}
            {summaryError ? <p className="sl-sa-chart-message">Account distribution unavailable.</p> : null}
          </div>
        </div>
      </Card>

      <Card id="sl-sa-status" title={<ChartCardTitle>Account Status</ChartCardTitle>}>
        <div className="sl-sa-status-content">
          <div className="sl-sa-status-layout">
            <div className="sl-sa-status-chart">
              <div className="sl-sa-status-donut" data-empty={summary?.totalUsers === 0 || undefined} role="img" aria-label={summary ? `${activeUsers} active and ${inactiveUsers} inactive accounts out of ${summary.totalUsers}` : 'Account status unavailable'} style={{
                background: summary?.totalUsers
                  ? `conic-gradient(var(--sl-sa-active) 0 ${activePercent}%, var(--sl-sa-inactive) ${activePercent}% 100%)`
                  : 'var(--sl-sa-empty-ring)'
              }}>
                <div className="sl-sa-status-center">
                  <strong>{summary ? `${activeUsers.toLocaleString()} / ${summary.totalUsers.toLocaleString()}` : '— / —'}</strong>
                  <small>active</small>
                </div>
              </div>
            </div>
            <div className="sl-sa-status-legend">
              <div className="sl-sa-status-item">
                <span className="sl-sa-status-dot" style={{ backgroundColor: 'var(--sl-sa-active)' }} />
                <span className="sl-sa-status-label">Active</span>
                <strong className="sl-sa-status-count">{summary ? activeUsers.toLocaleString() : '—'}</strong>
              </div>
              <div className="sl-sa-status-item">
                <span className="sl-sa-status-dot" style={{ backgroundColor: 'var(--sl-sa-inactive)' }} />
                <span className="sl-sa-status-label">Inactive</span>
                <strong className="sl-sa-status-count">{summary ? inactiveUsers.toLocaleString() : '—'}</strong>
              </div>
            </div>
          </div>
          {summary?.totalUsers === 0 ? <p className="sl-sa-chart-message">No accounts recorded.</p> : summaryError ? <p className="sl-sa-chart-message">Account status unavailable.</p> : null}
        </div>
      </Card>
    </section>

    <section className="sl-sa-middle-row sl-sa-dashboard-activity-row-v319">
      <section id="sl-sa-recent-activity" className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="sl-sa-recent-activity-title">
        <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
          <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
          <h2 id="sl-sa-recent-activity-title">Recent System Activity</h2>
          <div className="sl-staff-usage-head-actions"><Link href="/SecurityActivity" className="sl-staff-usage-viewall sl-v209-viewall-button">View All <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </header>
        <div className="sl-table-scroll sl-superadmin-table-scroll sl-staff-usage-table-shell">
          <AuditTable recent adminDashboard dashboardDetails />
        </div>
      </section>
    </section>
  </div>;
}
