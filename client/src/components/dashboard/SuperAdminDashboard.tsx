import { Link } from '../../routing/navigation';
import { ArrowRight, ChartNoAxesCombined, CheckCircle2, FileText, PieChart, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type DashboardSummary } from '../../services/administration';
import { sessionDisplayName, type SessionUser } from '../../services/auth';
import { buildAccountAnalytics } from '../../utils/account-analytics';
import { Card, PageHeader } from '../application/primitives';
import { FilterSelect } from '../application/FilterSelect';
import { ForecastVsActualChart, ForecastVsActualLegend } from '../application/ManagerForecastCharts';
import { emptyForecastWindow } from '../application/forecast-chart-data';
import { businessDateInputValue, businessDayRange, businessWeekRange } from '../../utils/business-day';
import { getForecastVsActual, listStockInIngredients, type ForecastVsActualResponse, type StockInIngredient } from '../../services/ingredients';
import { formatHumanReadableText } from '../../utils/display-text';

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

  // Forecast vs Actual chart state
  const [trendPeriod, setTrendPeriod] = useState('This Week');
  const [forecastSeriesVisible, setForecastSeriesVisible] = useState({ forecast: true, actual: true });
  const [ingredients, setIngredients] = useState<StockInIngredient[] | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [trendData, setTrendData] = useState<ForecastVsActualResponse | null>(null);

  const today = businessDateInputValue();
  const trendDays = Number(trendPeriod.match(/\d+/)?.[0] ?? 30);
  const { from: trendFrom, to: trendTo } = trendPeriod === 'This Week' ? businessWeekRange() : businessDayRange(trendDays);
  const trendWindow = emptyForecastWindow(trendFrom, trendTo);
  const forecastPeriodOptions = ['This Week', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'].map(value => ({ value, label: value }));

  useEffect(() => {
    const abort = new AbortController();
    listStockInIngredients(abort.signal)
      .then(res => {
        if (!abort.signal.aborted) setIngredients(res.ingredients);
      })
      .catch(() => {
        if (!abort.signal.aborted) setIngredients([]);
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const targetId = selectedIngredient || (ingredients && ingredients.length > 0 ? ingredients[0].id : '');
    if (!targetId) {
      setTrendData(null);
      return;
    }
    const controller = new AbortController();
    const days = trendPeriod === 'This Week' ? 7 : trendDays;
    getForecastVsActual(targetId, days, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) setTrendData(res);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTrendData(null);
      });
    return () => controller.abort();
  }, [selectedIngredient, ingredients, trendPeriod, trendDays]);

  const ingredientOptions = useMemo(() => [
    { value: '', label: 'Primary Ingredient' },
    ...(ingredients ?? []).map(item => ({ value: item.id, label: formatHumanReadableText(item.name) }))
  ], [ingredients]);

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
      <p className="sl-dashboard-description">Manage accounts, monitor inventory demand forecasts, and review system activity.</p>
    </div>
    <section className="sl-sa-kpis sl-superadmin-kpis sl-superadmin-dashboard-kpis-v201" aria-label="System overview">
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

    <section className="sl-sa-middle-row sl-sa-dashboard-activity-row-v319">
      <Card
        id="sl-sa-forecast"
        title={<ChartCardTitle Icon={ChartNoAxesCombined}>Forecast vs. Actual</ChartCardTitle>}
        action={
          <div className="sl-mgr-fc-header-tools">
            <ForecastVsActualLegend
              visible={forecastSeriesVisible}
              onToggle={series => setForecastSeriesVisible(current => ({ ...current, [series]: !current[series] }))}
            />
            {ingredients && ingredients.length > 1 && (
              <FilterSelect
                className="sl-dashboard-filter"
                ariaLabel="Select ingredient for forecast trend"
                value={selectedIngredient}
                options={ingredientOptions}
                onChange={setSelectedIngredient}
              />
            )}
            <FilterSelect
              className="sl-dashboard-filter"
              ariaLabel="Forecast trend period"
              value={trendPeriod}
              options={forecastPeriodOptions}
              onChange={setTrendPeriod}
            />
            <Link href="/Ingredients" className="sl-text-link" style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
              Ingredients <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <div style={{ padding: '0.5rem 0' }}>
          <ForecastVsActualChart
            ariaLabel="Forecast versus actual ingredient consumption by date"
            points={trendData?.status === 'FOUND' && trendData.points.length > 0 ? trendData.points : trendWindow}
            meta={trendData?.status === 'FOUND' && trendData.meta ? trendData.meta : { ingredient: 'Ingredient', unit: 'unit', asOf: today, horizonDays: trendDays }}
            visible={forecastSeriesVisible}
            calendarWeek={trendPeriod === 'This Week'}
            emptyLabel="No live forecast records yet"
            emptyDescription="Forecasted and actual ingredient consumption will appear when validated forecast and usage data are available."
          />
        </div>
      </Card>
    </section>
  </div>;
}
