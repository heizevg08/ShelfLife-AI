import { Box, Boxes, CheckCircle2, FileText, PieChart, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type DashboardSummary } from '../../services/administration';
import { sessionDisplayName, type SessionUser } from '../../services/auth';
import { buildAccountAnalytics } from '../../utils/account-analytics';
import { ApplicationDonutChart } from '../application/ApplicationPatterns';
import { Card, DataState, PageHeader } from '../application/primitives';
import { listIngredientCategories, listIngredients } from '../../services/ingredients';
import { getInventoryBatchSummary } from '../../services/inventory-batches';

const AUTO_REFRESH_MS = 15000;
function ChartCardTitle({ Icon, children }: { Icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="sl-dashboard-card-heading">
      {Icon && <span className="sl-application-card-icon"><Icon size={16} aria-hidden="true" /></span>}
      <span className="sl-sa-card-heading-copy"><span>{children}</span></span>
    </span>
  );
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
  // Only the count is needed here: this fetch exists purely for the "Audit Events (Last 30 Days)" KPI.
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

  // Ingredient Overview / Inventory Overview use the same live sources and states as the Admin dashboard.
  const [ingredientCategories, setIngredientCategories] = useState<{ label: string; value: number }[] | null>(null);
  const [ingredientCategoriesFailed, setIngredientCategoriesFailed] = useState(false);
  const [inventorySummary, setInventorySummary] = useState<Awaited<ReturnType<typeof getInventoryBatchSummary>> | null>(null);
  const [inventorySummaryFailed, setInventorySummaryFailed] = useState(false);
  const [inventoryRetry, setInventoryRetry] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setIngredientCategoriesFailed(false);
    listIngredientCategories(abort.signal)
      .then(async ({ categories }) => {
        const totals = await Promise.all(categories.map(async label => ({ label, value: (await listIngredients(1, 1, '', label, abort.signal)).total })));
        if (!abort.signal.aborted) setIngredientCategories(totals);
      })
      .catch(() => { if (!abort.signal.aborted) setIngredientCategoriesFailed(true); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setInventorySummary(null);
    setInventorySummaryFailed(false);
    getInventoryBatchSummary(abort.signal)
      .then(value => { if (!abort.signal.aborted) setInventorySummary(value); })
      .catch(error => { if (!abort.signal.aborted && (error as Error).name !== 'AbortError') setInventorySummaryFailed(true); });
    return () => abort.abort();
  }, [inventoryRetry]);

  const categoryStatus = ingredientCategoriesFailed ? 'Ingredient category data unavailable' : ingredientCategories === null ? 'Loading ingredient category data' : ingredientCategories.length ? undefined : 'No ingredient categories available';
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
      <p className="sl-dashboard-description">Manage accounts and review system activity.</p>
    </div>
    <section className="sl-sa-kpis sl-superadmin-kpis sl-kpi-reference-v201" aria-label="System overview">
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Total Users</span><strong>{totalUsers?.toLocaleString() ?? (summaryError && accountsError ? 'Unavailable' : 'Loading…')}</strong><small>System-wide accounts</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2 /></span><div><span>Active Accounts</span><strong>{summary ? summary.activeUsers.toLocaleString() : summaryError ? 'Unavailable' : 'Loading…'}</strong><small>{activePercentLabel === null ? 'Live account status' : `▲ ${activePercentLabel}% active`}</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Inactive Accounts</span><strong>{summary ? summary.inactiveUsers.toLocaleString() : summaryError ? 'Unavailable' : 'Loading…'}</strong><small>{summary ? 'Deactivated accounts' : 'Account summary unavailable'}</small></div></article>
      <article className="sl-sa-kpi sl-superadmin-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><FileText /></span><div><span>Audit Events (Last 30 Days)</span><strong>{auditCount !== null ? auditCount.toLocaleString() : auditError ? 'Unavailable' : 'Loading…'}</strong><small>{auditCount !== null ? 'Recorded in the last 30 days' : 'Audit summary unavailable'}</small></div></article>
    </section>

    <section className="sl-sa-analytics-row sl-sa-analytics-row-v317">
      <Card id="sl-sa-distribution" title={<ChartCardTitle Icon={Users}>User Distribution</ChartCardTitle>}>
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

      <Card id="sl-sa-status" title={<ChartCardTitle Icon={PieChart}>Account Status</ChartCardTitle>}>
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

    <section className="sl-sa-analytics-row sl-sa-analytics-row-v317 sl-sa-overview-pair" aria-label="Inventory analytics">
      <Card id="sl-sa-ingredient-overview" title={<ChartCardTitle Icon={Box}>Ingredient Overview</ChartCardTitle>}>
        <ApplicationDonutChart ariaLabel="Ingredient category overview" centerLabel="Ingredients" items={ingredientCategories ?? []} unavailableMessage={categoryStatus} />
      </Card>
      <Card id="sl-sa-inventory-overview" title={<ChartCardTitle Icon={Boxes}>Inventory Overview</ChartCardTitle>}>
        {inventorySummary
          ? <ApplicationDonutChart ariaLabel="Current inventory batch status distribution" centerLabel="Batches" centerValue={inventorySummary.totalBatches} items={Object.entries(inventorySummary.statusCounts).map(([label, value]) => ({ label, value }))} />
          : inventorySummaryFailed
            ? <DataState kind="error" title="Inventory unavailable" description="The inventory batch service could not be reached." action={<button type="button" className="sl-button" onClick={() => setInventoryRetry(value => value + 1)}>Retry</button>} />
            : <DataState kind="loading" title="Loading inventory" description="Retrieving current batch status totals." />}
      </Card>
    </section>
  </div>;
}
