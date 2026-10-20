import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Bell, Box, Boxes, CalendarClock, ClipboardList, FileText, ListChecks, ListOrdered, PhilippinePeso, Plus, TrendingUp, TriangleAlert, UsersRound, type LucideIcon } from 'lucide-react';
import { Link, useRouter } from '../../routing/navigation';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { ApplicationDonutChart, ApplicationPendingState } from '../application/ApplicationPatterns';
import { Card, DataState, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status } from '../application/primitives';
import { ForecastFlow, InventoryBatchDetailsDialog, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary, type DashboardSummary } from '../../services/administration';
import { getGeneralForecastAccuracy, listIngredientCategories, listIngredients, type ForecastAccuracyResponse } from '../../services/ingredients';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch } from '../../services/inventory-batches';
import { changeRequestStatusLabel, changeRequestTypeLabel, getChangeRequest, listChangeRequests, type ChangeRequest } from '../../services/change-requests';
import { getUsageSummary, type UsageSummary } from '../../services/usage-records';
import { formatDate } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { formatCompactPeso, formatExactPeso } from '../../utils/compact-number';
import { ChangeRequestDetailsDialog } from '../application/ChangeRequestDetailsDialog';
import { ManagerDailyRecordChart, type DailyPoint } from '../application/ManagerDailyRecordChart';
import { businessDateInputValue, shiftBusinessDate } from '../../utils/business-day';
import { inventoryAlertRecords } from '../../utils/inventory-alert-records';

function DashboardHeading({ userName, description, source = false, descriptionInHeader = false, className = '' }: { userName: string; description?: string; source?: boolean; descriptionInHeader?: boolean; className?: string }) {
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => {
    const update = () => { const hour = new Date().getHours(); setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'); };
    update(); const interval = window.setInterval(update, 30000); return () => window.clearInterval(interval);
  }, []);
  return <div className={`sl-dashboard-heading sl-dashboard-heading-v8${source ? ' sl-dashboard-source-heading' : ''}${className ? ` ${className}` : ''}`}><PageHeader eyebrow={descriptionInHeader ? 'Overview' : 'Dashboard'} title={`${greeting}, ${userName}.`} description={descriptionInHeader ? description : undefined} />{description && !descriptionInHeader && <p className="sl-dashboard-description">{description}</p>}</div>;
}

function DashboardCardTitle({ Icon, children }: { Icon: LucideIcon; children: ReactNode }) {
  return <span className="sl-dashboard-card-heading"><span className="sl-application-card-icon"><Icon aria-hidden="true" /></span><span>{children}</span></span>;
}

function DashboardRecordTable({ label, columns, emptyDescription }: { label: string; columns: string[]; emptyDescription?: string }) {
  return <div className="sl-dashboard-reference-table" role="region" aria-label={label} tabIndex={0}><table className="sl-data-table sl-reference-records-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{emptyDescription ? <tr><td colSpan={columns.length} className="sl-empty-cell"><ApplicationPendingState description={emptyDescription} /></td></tr> : <tr aria-label={`${label} unavailable`}>{columns.map(column => <td key={column}>—</td>)}</tr>}</tbody></table></div>;
}

function AdminDashboardTableSection({ id, title, Icon, href, children }: { id: string; title: string; Icon: LucideIcon; href: '/ExpirationMonitoring' | '/AdministrativeAudit'; children: ReactNode }) {
  return <section id={id} className="sl-staff-usage-card sl-admin-dashboard-records" aria-labelledby={`${id}-title`}>
    <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
      <span className="sl-staff-usage-head-icon"><Icon aria-hidden="true" /></span>
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="sl-staff-usage-head-actions"><Link href={href} className="sl-text-link">View all <ArrowRight size={14} aria-hidden="true" /></Link></div>
    </header>
    <div className="sl-staff-usage-table-shell">{children}</div>
  </section>;
}

function AdminDashboardContent({ userName }: { userName: string }) {
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientFailed, setIngredientFailed] = useState(false);
  const [ingredientCategories, setIngredientCategories] = useState<{ label: string; value: number }[] | null>(null);
  const [ingredientCategoriesFailed, setIngredientCategoriesFailed] = useState(false);
  const [userSummary, setUserSummary] = useState<DashboardSummary | null>(null);
  const [userSummaryFailed, setUserSummaryFailed] = useState(false);
  const [inventorySummary, setInventorySummary] = useState<Awaited<ReturnType<typeof getInventoryBatchSummary>> | null>(null);
  const [inventorySummaryFailed, setInventorySummaryFailed] = useState(false);
  const [inventoryRetry, setInventoryRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setIngredientFailed(false);
    listIngredients(1, 1, '', '', abort.signal)
      .then(data => { if (!abort.signal.aborted) setIngredientTotal(data.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientFailed(true); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let retryTimer: number | undefined;
    setInventorySummary(null);
    setInventorySummaryFailed(false);
    const load = (attempt: number) => {
      getInventoryBatchSummary(abort.signal)
        .then(value => { if (!abort.signal.aborted) setInventorySummary(value); })
        .catch(error => {
          if (abort.signal.aborted || (error as Error).name === 'AbortError') return;
          if (attempt < 2) retryTimer = window.setTimeout(() => load(attempt + 1), 1_000);
          else setInventorySummaryFailed(true);
        });
    };
    load(1);
    return () => { abort.abort(); if (retryTimer !== undefined) window.clearTimeout(retryTimer); };
  }, [inventoryRetry]);
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
    setUserSummaryFailed(false);
    accountSummary(abort.signal)
      .then(value => { if (!abort.signal.aborted) setUserSummary(value); })
      .catch(() => { if (!abort.signal.aborted) setUserSummaryFailed(true); });
    return () => abort.abort();
  }, []);

  const ingredientValue = ingredientTotal === null ? '—' : ingredientTotal.toLocaleString();
  const userValue = userSummary?.totalUsers.toLocaleString() ?? '—';
  const userOverview = [
    { label: 'Admin', value: userSummary ? (userSummary.roleCounts?.Admin ?? 0) : undefined },
    { label: 'Manager', value: userSummary ? (userSummary.roleCounts?.Manager ?? 0) : undefined },
    { label: 'Inventory Staff', value: userSummary ? (userSummary.roleCounts?.['Inventory Staff'] ?? 0) : undefined },
  ];
  const categoryStatus = ingredientCategoriesFailed ? 'Ingredient category data unavailable' : ingredientCategories === null ? 'Loading ingredient category data' : ingredientCategories.length ? undefined : 'No ingredient categories available';
  const accountStatus = userSummaryFailed ? 'User overview unavailable' : userSummary === null ? 'Loading user overview' : undefined;

  return <>
    <DashboardHeading userName={userName} description="Here's an overview of your establishment's inventory and ingredient status." descriptionInHeader />
    <div className="sl-admin-view sl-admin-dashboard-v103">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Establishment inventory overview">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span><div><span>Total Users</span><strong>{userValue}</strong><small>{userSummaryFailed ? 'Accounts unavailable' : userSummary === null ? 'Loading accounts' : 'Authorized accounts'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Box aria-hidden="true" /></span><div><span>Total Ingredients</span><strong>{ingredientValue}</strong><small>{ingredientFailed ? 'Ingredients unavailable' : ingredientTotal === null ? 'Loading ingredients' : 'Current ingredients'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Inventory Batches</span><strong>{inventorySummary?.totalBatches.toLocaleString() ?? '—'}</strong><small>{inventorySummaryFailed ? 'Batches unavailable' : inventorySummary ? 'Current batches' : 'Loading batches'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>{inventorySummary?.nearExpiry.toLocaleString() ?? '—'}</strong><small>{inventorySummaryFailed ? 'Expiry unavailable' : inventorySummary ? 'Within 7 days' : 'Loading expiry'}</small></div></article>
      </section>

      <section className="sl-admin-reference-analytics" aria-label="Inventory analytics">
        <Card id="admin-ingredient-overview" title={<DashboardCardTitle Icon={Box}>Ingredient Overview</DashboardCardTitle>}><ApplicationDonutChart ariaLabel="Ingredient category overview" centerLabel="Ingredients" items={ingredientCategories ?? []} unavailableMessage={categoryStatus} /></Card>
        <Card id="admin-user-overview" title={<DashboardCardTitle Icon={UsersRound}>User Overview</DashboardCardTitle>}><ApplicationDonutChart ariaLabel="Current Admin, Manager, and Inventory Staff account totals" centerLabel="Users" items={userOverview} unavailableMessage={accountStatus} /></Card>
        <Card id="admin-inventory-overview" title={<DashboardCardTitle Icon={Boxes}>Inventory Overview</DashboardCardTitle>}>
          {inventorySummary
            ? <ApplicationDonutChart ariaLabel="Current inventory batch status distribution" centerLabel="Batches" centerValue={inventorySummary.totalBatches} items={Object.entries(inventorySummary.statusCounts).map(([label, value]) => ({ label, value }))} />
            : inventorySummaryFailed
              ? <DataState kind="error" title="Inventory unavailable" description="The inventory batch service could not be reached." action={<button type="button" className="sl-button" onClick={() => setInventoryRetry(value => value + 1)}>Retry</button>} />
              : <DataState kind="loading" title="Loading inventory" description="Retrieving current batch status totals." />}
        </Card>
      </section>

      <section className="sl-admin-dashboard-record-grid sl-admin-dashboard-record-grid-single" aria-label="Admin dashboard records">
        <AdminDashboardTableSection id="admin-recent-activity" title="Recent User Activity" Icon={FileText} href="/AdministrativeAudit">
          <AuditTable recent adminDashboard />
        </AdminDashboardTableSection>
      </section>

    </div>
  </>;
}

function ManagerDashboardContent({ userName }: { userName: string }) {
  const batchTrigger = useRef<HTMLTableRowElement>(null);
  const requestTrigger = useRef<HTMLTableRowElement>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getInventoryBatchSummary>> | null>(null);
  const [expirations, setExpirations] = useState<InventoryBatch[] | null>(null);
  const [allBatches, setAllBatches] = useState<InventoryBatch[] | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [accuracy, setAccuracy] = useState<ForecastAccuracyResponse | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [accuracyError, setAccuracyError] = useState(false);
  const [batchDetail, setBatchDetail] = useState<InventoryBatch | null>(null);
  const [requestDetail, setRequestDetail] = useState<ChangeRequest | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getInventoryBatchSummary(controller.signal),
      listInventoryBatches({ page: 1, pageSize: 5, status: 'Near Expiry', sort: 'fefo' }, controller.signal),
      listInventoryBatches({ page: 1, pageSize: 150 }, controller.signal),
    ])
      .then(([nextSummary, records, allRecords]) => {
        if (!controller.signal.aborted) {
          setSummary(nextSummary);
          setExpirations(records.items);
          setAllBatches(allRecords.items);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setInventoryError(true); });
    listChangeRequests({ page: 1, pageSize: 10, status: 'PENDING', currentOnly: true }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRequests(result.items.slice(0, 5)); })
      .catch(() => { if (!controller.signal.aborted) setRequestError(true); });
    getGeneralForecastAccuracy(controller.signal)
      .then(data => { if (!controller.signal.aborted) setAccuracy(data); })
      .catch(() => { if (!controller.signal.aborted) setAccuracyError(true); });
    return () => controller.abort();
  }, []);

  const stockStatusData = useMemo(() => {
    if (!summary) return null;
    const inStock = summary.statusCounts['In Stock'] ?? 0;
    const lowStock = summary.statusCounts['Low Stock'] ?? 0;
    const nearExpiry = summary.statusCounts['Near Expiry'] ?? 0;
    const expired = summary.statusCounts['Expired'] ?? 0;
    const total = summary.totalBatches || 1;
    const percentage = Math.round((inStock / total) * 100);

    const statuses = [
      { label: 'In Stock', count: inStock, color: '#166534', barColor: '#16a34a' },
      { label: 'Low Stock', count: lowStock, color: '#b45309', barColor: '#d97706' },
      { label: 'Near Expiry', count: nearExpiry, color: '#c2410c', barColor: '#ea580c' },
      { label: 'Expired', count: expired, color: '#b91c1c', barColor: '#dc2626' },
    ];

    return { inStock, lowStock, nearExpiry, expired, total: summary.totalBatches, percentage, statuses };
  }, [summary]);

  const next7DaysData = useMemo(() => {
    if (!allBatches) return null;
    const today = businessDateInputValue();
    const days = Array.from({ length: 7 }, (_, i) => {
      const dateStr = shiftBusinessDate(today, i);
      const d = new Date(`${dateStr}T00:00:00Z`);
      const label = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
      const matchingBatches = allBatches.filter(b => b.expirationDate.slice(0, 10) === dateStr && b.quantity > 0);
      const severity: 'High' | 'Medium' = i <= 3 ? 'High' : 'Medium';
      return {
        date: dateStr,
        label,
        count: matchingBatches.length,
        batches: matchingBatches,
        severity,
      };
    });

    const maxScale = Math.max(2, ...days.map(d => d.count));

    const expiringBatches = allBatches
      .filter(b => {
        const d = b.expirationDate.slice(0, 10);
        return d >= today && d <= shiftBusinessDate(today, 6) && b.quantity > 0;
      })
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

    let calloutText: ReactNode = 'No batches expiring within the next 7 days.';
    if (expiringBatches.length > 0) {
      const uniqueIngredients: { name: string; date: string }[] = [];
      for (const b of expiringBatches) {
        const d = new Date(`${b.expirationDate.slice(0, 10)}T00:00:00Z`);
        const dayLabel = String(d.getUTCDate());
        const ingName = formatHumanReadableText(b.ingredient.name);
        if (!uniqueIngredients.some(u => u.name === ingName)) {
          uniqueIngredients.push({ name: ingName, date: dayLabel });
        }
      }
      if (uniqueIngredients.length >= 2) {
        const d1 = uniqueIngredients[0].date;
        const d2 = uniqueIngredients[1].date;
        const month = new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' }).format(
          new Date(`${expiringBatches[0].expirationDate.slice(0, 10)}T00:00:00Z`)
        );
        calloutText = (
          <>
            Use <strong>{uniqueIngredients[0].name}</strong> and <strong>{uniqueIngredients[1].name}</strong> first. They expire on {d1} and {d2} {month}.
          </>
        );
      } else if (uniqueIngredients.length === 1) {
        const d = new Date(`${expiringBatches[0].expirationDate.slice(0, 10)}T00:00:00Z`);
        const formattedDate = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
        calloutText = (
          <>
            Use <strong>{uniqueIngredients[0].name}</strong> first. It expires on {formattedDate}.
          </>
        );
      }
    }

    return { days, maxScale, calloutText };
  }, [allBatches]);

  const alertItems = useMemo(() => inventoryAlertRecords(allBatches ?? []).map(alert => ({
    ...alert,
    ingredient: formatHumanReadableText(alert.ingredient),
    group: alert.priority === 'High' ? 'ACT NOW' : 'PLAN THIS WEEK',
    tone: alert.priority === 'High' ? 'critical' : 'attention',
    tag: alert.batchStatus === 'Expired' ? 'Expired' : alert.batchStatus === 'Low Stock' ? 'Low stock' : `${alert.daysLeft}d left`,
  })), [allBatches]);

  const pendingState = (description: string) => <div className="sl-manager-reference-state"><ApplicationPendingState description={description} /></div>;
  const openRequest = async (request: ChangeRequest, trigger: HTMLTableRowElement) => {
    requestTrigger.current = trigger;
    try { setRequestDetail(await getChangeRequest(request.id)); } catch { setRequestDetail(request); }
  };
  const recordState = (columns: number, loading: boolean, failed: boolean, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : loading ? 'Loading records' : 'No live records yet'} description={failed ? 'The service could not be reached.' : loading ? 'Retrieving current records.' : description} /></td></tr>;
  return <>
    <DashboardHeading userName={userName} description="Review inventory priorities, pending decisions, and operational risk." descriptionInHeader className="sl-manager-dashboard-heading" />
    <div className="sl-admin-view sl-manager-dashboard-v116 sl-manager-dashboard-v117">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Manager inventory overview">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso /></span><div><span>Total Inventory Value</span><strong title={summary?.inventoryValue !== null && summary?.inventoryValue !== undefined && Number.isFinite(summary.inventoryValue) ? formatExactPeso(summary.inventoryValue) : undefined}>{inventoryError || summary?.inventoryValue === null || summary?.inventoryValue === undefined || !Number.isFinite(summary.inventoryValue) ? '—' : formatCompactPeso(summary.inventoryValue)}</strong><small>{inventoryError ? 'Value unavailable' : !summary ? 'Loading value' : summary.inventoryValue === null ? 'Unit cost unavailable' : 'Stock valued at unit cost'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TriangleAlert /></span><div><span>Near Expiry ≤ 7 Days</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{inventoryError ? 'Expiry data unavailable' : summary ? 'Batches expiring soon' : 'Loading expiry data'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{inventoryError ? 'Stock data unavailable' : summary ? 'Below minimum stock' : 'Loading stock data'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span>{accuracy?.status === 'AVAILABLE' ? <><strong>{accuracy.metrics.accuracyScore}%</strong><small>{accuracy.metrics.evaluatedDays} days evaluated</small></> : accuracy?.status === 'UNAVAILABLE' ? <><strong>—</strong><small>{accuracy.evaluatedDays}/{accuracy.minimumRequiredDays} days evaluated</small></> : <><strong>{accuracyError ? '—' : '…'}</strong><small>{accuracyError ? 'Forecast unavailable' : 'Loading forecast'}</small></>}</div></article>
      </section>

      <section className="sl-manager-reference-grid" aria-label="Manager inventory analytics">
        <Card
          id="manager-stock-status"
          title={
            <span className="sl-dashboard-card-heading">
              <span className="sl-application-card-icon"><Boxes aria-hidden="true" /></span>
              <span className="sl-mgr-card-title-group">
                <span className="sl-mgr-card-main-title">Stock Status</span>
                <span className="sl-mgr-card-sub">
                  {summary ? `How your ${summary.totalBatches} batches are doing` : 'How your batches are doing'}
                </span>
              </span>
            </span>
          }
        >
          {stockStatusData ? (
            <div className="sl-mgr-stock-body">
              <div className="sl-mgr-stock-hero">
                <span className="sl-mgr-stock-hero-val">{stockStatusData.percentage}%</span>
                <span className="sl-mgr-stock-hero-label">
                  are in good shape ({stockStatusData.inStock} of {stockStatusData.total})
                </span>
              </div>

              <div className="sl-mgr-stock-rows">
                {stockStatusData.statuses.map(({ label, count, color, barColor }) => (
                  <div className="sl-mgr-stock-row" key={label}>
                    <div className="sl-mgr-stock-row-info">
                      <span className="sl-mgr-stock-dot" style={{ backgroundColor: color }} />
                      <span className="sl-mgr-stock-row-label">{label}</span>
                    </div>
                    <div className="sl-mgr-stock-bar-track">
                      <div
                        className="sl-mgr-stock-bar-fill"
                        style={{
                          width: `${stockStatusData.total > 0 ? Math.max((count / stockStatusData.total) * 100, count > 0 ? 3 : 0) : 0}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <span className="sl-mgr-stock-row-count">{count}</span>
                  </div>
                ))}
              </div>

              <div className="sl-mgr-stock-alert-banner">
                <div className="sl-mgr-stock-alert-icon">
                  <TriangleAlert size={14} aria-hidden="true" />
                </div>
                <span className="sl-mgr-stock-alert-text">
                  {stockStatusData.lowStock > 0 || stockStatusData.expired > 0 ? (
                    <>
                      <strong>{stockStatusData.lowStock} low-stock</strong> and <strong>{stockStatusData.expired} expired batches</strong> need a decision.
                    </>
                  ) : (
                    'All batches are currently in good operational shape.'
                  )}
                </span>
                <Link href="/Inventory#inventory-records" className="sl-mgr-stock-alert-link">
                  Review <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : inventoryError ? (
            <DataState kind="error" title="Data unavailable" description="Inventory status data could not be loaded." />
          ) : (
            <DataState kind="loading" title="Loading inventory status" description="Retrieving current batch status totals." />
          )}
        </Card>

        <Card
          id="manager-expiring-items"
          title={
            <span className="sl-dashboard-card-heading">
              <span className="sl-application-card-icon"><CalendarClock aria-hidden="true" /></span>
              <span className="sl-mgr-card-title-group">
                <span className="sl-mgr-card-main-title">Expiring in the Next 7 Days</span>
                <span className="sl-mgr-card-sub">How many batches expire each day</span>
              </span>
            </span>
          }
          action={
            <div className="sl-mgr-expiring-legend" aria-hidden="true">
              <span><i style={{ backgroundColor: '#dc2626' }} /> High</span>
              <span><i style={{ backgroundColor: '#d97706' }} /> Medium</span>
            </div>
          }
        >
          {next7DaysData ? (
            <div className="sl-mgr-expiring-body">
              <div className="sl-mgr-expiring-chart" aria-label="Batches expiring each day over the next 7 days">
                <div className="sl-mgr-expiring-gridlines" aria-hidden="true">
                  <div className="sl-mgr-expiring-gridline">
                    <span className="sl-mgr-expiring-gridline-label">{next7DaysData.maxScale}</span>
                  </div>
                  <div className="sl-mgr-expiring-gridline">
                    <span className="sl-mgr-expiring-gridline-label">{Math.round(next7DaysData.maxScale / 2)}</span>
                  </div>
                  <div className="sl-mgr-expiring-gridline">
                    <span className="sl-mgr-expiring-gridline-label">0</span>
                  </div>
                </div>

                <div className="sl-mgr-expiring-columns">
                  {next7DaysData.days.map(day => {
                    const heightPercent = next7DaysData.maxScale > 0
                      ? (day.count / next7DaysData.maxScale) * 100
                      : 0;
                    return (
                      <div className="sl-mgr-expiring-col" key={day.date}>
                        <span className={`sl-mgr-expiring-col-val ${day.count === 0 ? 'sl-mgr-val-zero' : ''}`}>
                          {day.count}
                        </span>
                        <div
                          className="sl-mgr-expiring-col-bar"
                          style={{
                            height: day.count > 0 ? `${Math.max(heightPercent, 14)}%` : '0%',
                            backgroundColor: day.count > 0 ? (day.severity === 'High' ? '#dc2626' : '#d97706') : 'transparent',
                          }}
                        />
                        <span className="sl-mgr-expiring-col-date">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sl-mgr-expiring-alert-banner">
                <div className="sl-mgr-expiring-alert-icon">
                  <CalendarClock size={14} aria-hidden="true" />
                </div>
                <span className="sl-mgr-expiring-alert-text">
                  {next7DaysData.calloutText}
                </span>
                <Link href="/Inventory" className="sl-mgr-expiring-alert-link">
                  View batches <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : inventoryError ? (
            <DataState kind="error" title="Data unavailable" description="Expiring items data could not be loaded." />
          ) : (
            <DataState kind="loading" title="Loading expiring items trend" description="Retrieving batch expiration timeline." />
          )}
        </Card>
      </section>

      <section className="sl-manager-attention-grid" aria-label="Manager attention queue">
        <Card
          id="manager-alert-records"
          title={<DashboardCardTitle Icon={Bell}>Alert Records</DashboardCardTitle>}
          action={<Link href="/Alerts" className="sl-text-link">View All <ArrowRight size={14}/></Link>}
        >
          <div className="sl-mgr-alert-card-body">
            <div className="sl-mgr-alert-list">
              {alertItems.length > 0 ? (
                <>
                  {alertItems.some(a => a.group === 'ACT NOW') && (
                    <div className="sl-mgr-alert-section">
                      <span className="sl-mgr-alert-section-title">ACT NOW</span>
                      {alertItems
                        .filter(a => a.group === 'ACT NOW')
                        .slice(0, 2)
                        .map(alert => (
                          <div className="sl-mgr-alert-item" key={alert.id} data-tone={alert.tone}>
                            <div className="sl-mgr-alert-item-left">
                              <span className="sl-mgr-alert-dot" />
                              <div className="sl-mgr-alert-info">
                                <span className="sl-mgr-alert-ingredient">{alert.ingredient}</span>
                                <span className="sl-mgr-alert-detail">{alert.details}</span>
                              </div>
                            </div>
                            <span className="sl-mgr-alert-badge">{alert.tag}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {alertItems.some(a => a.group === 'PLAN THIS WEEK') && (
                    <div className="sl-mgr-alert-section">
                      <span className="sl-mgr-alert-section-title">PLAN THIS WEEK</span>
                      {alertItems
                        .filter(a => a.group === 'PLAN THIS WEEK')
                        .slice(0, 2)
                        .map(alert => (
                          <div className="sl-mgr-alert-item" key={alert.id} data-tone={alert.tone}>
                            <div className="sl-mgr-alert-item-left">
                              <span className="sl-mgr-alert-dot" />
                              <div className="sl-mgr-alert-info">
                                <span className="sl-mgr-alert-ingredient">{alert.ingredient}</span>
                                <span className="sl-mgr-alert-detail">{alert.details}</span>
                              </div>
                            </div>
                            <span className="sl-mgr-alert-badge">{alert.tag}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : inventoryError ? (
                <DataState kind="error" title="Data unavailable" description="Alerts could not be loaded." />
              ) : allBatches === null ? (
                <DataState kind="loading" title="Loading alerts" description="Retrieving current inventory alerts." />
              ) : (
                <DataState kind="empty" title="No alerts" description="There are no urgent inventory alerts at this time." />
              )}
            </div>

          </div>
        </Card>
        <Card id="manager-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>Pending Requests</DashboardCardTitle>} action={<Link href="/ChangeRequests" className="sl-text-link">View All <ArrowRight size={14}/></Link>}>
          <div className="sl-dashboard-reference-table"><table className="sl-data-table sl-reference-records-table sl-manager-dashboard-table sl-manager-requests-table"><colgroup><col /><col /><col /><col /></colgroup><thead><tr>{['Request ID', 'Request Type', 'Submitted By', 'Status'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{requests?.length ? requests.map(request => <tr key={request.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event => void openRequest(request, event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openRequest(request, event.currentTarget); } }}><td data-label="Request ID"><span className="sl-canonical-identifier sl-emphasized-value">{request.requestID}</span></td><td data-label="Request Type">{formatHumanReadableText(request.requestType.replaceAll('_', ' '))}</td><td data-label="Submitted By">{formatHumanReadableText(request.requestedBy.name)}</td><td data-label="Status"><Status tone="attention">{changeRequestStatusLabel(request.status)}</Status></td></tr>) : recordState(4, requests === null && !requestError, requestError, 'Requests awaiting review will appear here.')}</tbody></table></div>
        </Card>
      </section>
    </div>
    <InventoryBatchDetailsDialog batch={batchDetail} onDismiss={() => setBatchDetail(null)} returnFocus={batchTrigger} />
    <ChangeRequestDetailsDialog request={requestDetail} onDismiss={() => setRequestDetail(null)} returnFocus={requestTrigger} />
  </>;
}

function InventoryStaffDashboardContent({ userName }: { userName: string }) {
  const router = useRouter();
  const requestTrigger = useRef<HTMLButtonElement>(null);
  const batchTrigger = useRef<HTMLTableRowElement>(null);
  const [inventory, setInventory] = useState<InventoryBatch[] | null>(null);
  const [inventorySummary, setInventorySummary] = useState<{ totalIngredients: number; totalBatches: number; nearExpiry: number; lowStockItems: number } | null>(null);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [inventorySummaryFailed, setInventorySummaryFailed] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[] | null>(null);
  const [pendingRequestsFailed, setPendingRequestsFailed] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageSummaryFailed, setUsageSummaryFailed] = useState(false);
  const [detail, setDetail] = useState<ChangeRequest | null>(null);
  const [batchDetail, setBatchDetail] = useState<InventoryBatch | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    listInventoryBatches({ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true }, abort.signal)
      .then(records => { if (!abort.signal.aborted) setInventory(records.items); })
      .catch(() => { if (!abort.signal.aborted) setInventoryFailed(true); });
    getInventoryBatchSummary(abort.signal)
      .then(summary => { if (!abort.signal.aborted) setInventorySummary({ totalIngredients: summary.totalIngredients, totalBatches: summary.totalBatches, nearExpiry: summary.nearExpiry, lowStockItems: summary.lowStockItems }); })
      .catch(() => { if (!abort.signal.aborted) setInventorySummaryFailed(true); });
    void listChangeRequests({ page: 1, pageSize: 10, status: 'PENDING', currentOnly: true }, abort.signal).then(result => { if (!abort.signal.aborted) setPendingRequests(result.items.slice(0, 5)); }).catch(() => { if (!abort.signal.aborted) setPendingRequestsFailed(true); });
    void getUsageSummary(abort.signal).then(result => { if (!abort.signal.aborted) setUsageSummary(result); }).catch(() => { if (!abort.signal.aborted) setUsageSummaryFailed(true); });
    return () => abort.abort();
  }, []);
  const stateRow = (columns: number, kind: 'loading' | 'empty' | 'error', title: string, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={kind} title={title} description={description} /></td></tr>;
  const requestStatus = (request: ChangeRequest) => changeRequestStatusLabel(request.status);
  const requestStatusTone = (request: ChangeRequest) => request.status === 'APPROVED' ? 'success' as const : request.status === 'REJECTED' ? 'critical' as const : 'attention' as const;
  const openRequest = async (id: string) => { try { setDetail(await getChangeRequest(id)); } catch { setDetail(null); } };
  const usageValue = usageSummaryFailed || usageSummary === null ? '\u2014' : usageSummary.usageRecordsToday;
  const usageHelper = usageSummaryFailed ? 'Usage unavailable' : usageSummary === null ? 'Loading usage' : 'Usage logged today';

  return <div className="sl-admin-view sl-inventory-staff-dashboard-v140 sl-dashboard-source-layout">
      <DashboardHeading userName={userName} source description="Your inventory overview for today. Keep track, record accurately, and help reduce food waste." />
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-dashboard-source-kpis" aria-label="Inventory staff dashboard summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span><div><span>Today&apos;s Usage</span><strong>{usageValue}</strong><small>{usageHelper}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>{inventorySummary?.totalBatches ?? '—'}</strong><small>{inventorySummaryFailed ? 'Batches unavailable' : 'Current batches'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>{inventorySummary?.nearExpiry ?? '—'}</strong><small>{inventorySummaryFailed ? 'Expiration service unavailable' : 'Within 7 days'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList aria-hidden="true" /></span><div><span>Low Stock</span><strong>{inventorySummary?.lowStockItems ?? '—'}</strong><small>{inventorySummaryFailed ? 'Stock summary unavailable' : 'Below minimum stock'}</small></div></article>
      </section>

      <nav className="sl-inventory-staff-quick-actions" aria-label="Quick Actions">
        <strong>Quick Actions</strong><div><Link href="/StockIn" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Add Stock-In</Link><Link href="/UsageRecording" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Record Usage</Link><Link href="/WasteRecording" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Record Waste</Link></div>
      </nav>

      <div className="sl-inventory-staff-preview-grid"><section className="sl-inventory-staff-analytics" aria-label="Use first inventory">
        <Card id="inventory-staff-fefo" title={<DashboardCardTitle Icon={ListOrdered}>Use First · FEFO</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-dashboard-source-table-shell sl-inventory-staff-fefo-table" role="region" aria-label="Use First FEFO" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table"><thead><tr>{['#','Ingredient','Batch ID','Expiration Date','Days Left'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{inventory?.length ? inventory.map((batch, index) => <tr key={batch.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{batchTrigger.current=event.currentTarget;setBatchDetail(batch)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();batchTrigger.current=event.currentTarget;setBatchDetail(batch)}}}><td data-label="#">{index + 1}</td><td data-label="Ingredient" className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td data-label="Batch ID"><span className="sl-canonical-identifier">{batch.batchID}</span></td><td data-label="Expiration Date">{formatDate(batch.expirationDate)}</td><td data-label="Days Left">{batch.daysLeft < 0 ? 'Expired' : batch.daysLeft}</td></tr>) : inventoryFailed ? stateRow(5, 'error', 'Inventory unavailable', 'Inventory batches could not be loaded.') : inventory === null ? stateRow(5, 'loading', 'Loading inventory batches', 'Retrieving FEFO-priority records.') : stateRow(5, 'empty', 'No inventory batches yet', 'FEFO-priority batches will appear after stock is received.')}</tbody></table></div>
        </Card>
      </section>

      <section className="sl-inventory-staff-bottom" aria-label="Inventory staff dashboard records">
        <Card id="inventory-staff-my-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>My Pending Requests</DashboardCardTitle>} action={<Link href="/MyRequests" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-inventory-staff-dashboard-table sl-dashboard-source-table-shell" role="region" aria-label="My Pending Requests" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table sl-change-request-preview-table sl-inventory-staff-pending-requests-table"><colgroup><col className="sl-pending-request-id-column" /><col className="sl-pending-request-change-column" /><col className="sl-pending-request-date-column" /><col className="sl-pending-request-status-column" /></colgroup><thead><tr>{['Request ID','Requested Change','Submitted On','Status'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{pendingRequests?.length ? pendingRequests.map(request => <tr key={request.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{requestTrigger.current=event.currentTarget.querySelector('button');void openRequest(request.id)}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();requestTrigger.current=event.currentTarget.querySelector('button');void openRequest(request.id)}}}><td><button type="button" className="sl-record-identifier-link sl-emphasized-value" onClick={event => { event.stopPropagation(); requestTrigger.current = event.currentTarget; void openRequest(request.id); }}>{request.requestID}</button></td><td>{changeRequestTypeLabel(request.requestType)}</td><td>{formatDate(request.createdAt)}</td><td><Status tone={requestStatusTone(request)}>{requestStatus(request)}</Status></td></tr>) : pendingRequestsFailed ? stateRow(4, 'error', 'Requests unavailable', 'Pending requests could not be loaded.') : pendingRequests === null ? stateRow(4, 'loading', 'Loading pending requests', 'Retrieving your submitted requests.') : stateRow(4, 'empty', 'No pending requests', 'You have no requests awaiting review.')}</tbody></table></div>
        </Card>
      </section></div>
      <InventoryBatchDetailsDialog batch={batchDetail} inventoryStaff onDismiss={() => setBatchDetail(null)} onRecordWaste={batch => { setBatchDetail(null); router.push({ pathname: '/WasteRecording', params: { recordWaste: '1', ingredientId: batch.ingredient.id, batchId: batch.id } }); }} returnFocus={batchTrigger} />
      <ChangeRequestDetailsDialog inventoryStaff request={detail} onDismiss={() => setDetail(null)} returnFocus={requestTrigger} />
    </div>;
}

function UnavailableSummary({ role }: { role: 'Manager' | 'Inventory Staff' }) {
  const items = role === 'Manager'
    ? ['Use-first batches', 'Low-stock items', 'Expiring batches', 'Pending requests']
    : ['Use-first batches', 'Recent transactions', 'Active alerts', 'My open requests'];
  const tones = ['brand', 'success', 'attention', 'critical'] as const;
  return <PlaceholderSummaryCards items={items.map((label, index) => ({ label, tone: tones[index] }))} />;
}

function RolePanel({ children }: { children: ReactNode }) {
  return <div className="sl-role-panel">{children}<ArrowRight size={18} aria-hidden="true" /></div>;
}

export default function RoleDashboard() {
  const { user } = useApplicationWorkspace();
  const admin = user.role === 'Admin';
  if (admin) return <AdminDashboardContent userName={sessionDisplayName(user)} />;
  const staff = user.role === 'Inventory Staff';
  const manager = user.role === 'Manager';
  if (manager) return <ManagerDashboardContent userName={sessionDisplayName(user)} />;
  if (staff) return <InventoryStaffDashboardContent userName={sessionDisplayName(user)} />;
  const description = admin
    ? 'Manage operational accounts, ingredient master data and administrative oversight.'
    : manager
      ? 'Review inventory priorities, requests and decision support.'
      : 'Receive stock, record transactions and follow your submitted requests.';

  return <>
    <DashboardHeading userName={sessionDisplayName(user)} />
    <p className="sl-dashboard-description">{description}</p>
    <div className="sl-admin-view">
      <UnavailableSummary role={staff ? 'Inventory Staff' : 'Manager'} />

      {staff && <section className="sl-role-focus sl-role-focus-compact" aria-labelledby="staff-priority-title">
        <div><p className="sl-eyebrow">Use first · FEFO</p><h2 id="staff-priority-title" className="sl-section-title">Priority batch unavailable</h2>
          <p className="sl-supporting">The inventory service will identify the earliest-expiring eligible batch here.</p></div>
        <WorkspaceLink to="/InventoryBatches" primary>View inventory</WorkspaceLink>
      </section>}

      <div className="sl-module-columns">
        <Card id="role-primary" title={admin ? 'Operational account directory' : 'Batch inventory'} action={<WorkspaceLink to={admin ? '/UserManagement' : '/InventoryBatches'}>View all <ArrowRight size={14} aria-hidden="true" /></WorkspaceLink>}>
          {admin ? <AccountsTable /> : <PlaceholderTable
            label={admin ? 'Operational account preview' : 'Inventory overview'}
            columns={admin ? ['Name', 'Email', 'Role', 'Status'] : ['Ingredient', 'Batch', 'Quantity', 'Expiration', 'Status']}
            description={admin ? 'Manager and Inventory Staff accounts' : 'Batch-level stock ordered for review'}
          />}
        </Card>
        <Card id="role-secondary" title={admin ? 'Ingredient master data' : staff ? 'My requests' : 'Change requests'} action={<ListChecks size={18} aria-hidden="true" />}>
          <RolePanel><div><Status>Service unavailable</Status><p className="sl-supporting">{admin ? 'Ingredients remain separate from received inventory batches.' : staff ? 'Your submitted corrections will appear here.' : 'Requests awaiting Manager review will appear here.'}</p>
            <WorkspaceLink to={admin ? '/Ingredients' : '/ChangeRequests'}>{admin ? 'Open ingredients' : 'Open requests'}</WorkspaceLink></div></RolePanel>
        </Card>
      </div>

      {manager && <ForecastFlow />}
      <section aria-labelledby="role-actions"><div className="sl-section-heading"><h2 id="role-actions" className="sl-section-title">{staff ? 'Daily actions' : 'Workspace tools'}</h2></div>
        <div className={`sl-workflow-links${staff ? ' sl-workflow-links-three' : ''}`}>
          {admin ? <><WorkflowLink to="/AdministrativeAudit" title="Audit Logs" description="Review administrative account changes." /><WorkflowLink to="/Reports" title="Reports & Analytics" description="Open the reporting workspace." /></>
            : staff ? <><WorkflowLink to="/StockIn" title="Stock-In" description="Receive a batch against an ingredient." /><WorkflowLink to="/UsageRecording" title="Record usage" description="Log quantities consumed from a batch." /><WorkflowLink to="/WasteRecording" title="Record waste" description="Log discarded quantities and reasons." /></>
            : <><WorkflowLink to="/UsageWaste" title="Usage & Waste" description="Review consumption and loss transactions." /><WorkflowLink to="/Alerts" title="Alerts" description="Review inventory and expiration attention." /></>}
        </div>
      </section>
    </div>
  </>;
}
