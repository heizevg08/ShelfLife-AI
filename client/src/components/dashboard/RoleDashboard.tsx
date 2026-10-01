import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Box, Boxes, CalendarClock, ClipboardList, FileText, ListChecks, ListOrdered, PhilippinePeso, Plus, TrendingUp, TriangleAlert, UsersRound, type LucideIcon } from 'lucide-react';
import { Link } from 'expo-router';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { ApplicationDonutChart, ApplicationPendingState } from '../application/ApplicationPatterns';
import { Card, DataState, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status } from '../application/primitives';
import { ForecastFlow, InventoryBatchDetailsDialog, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary, type DashboardSummary } from '../../services/administration';
import { listIngredientCategories, listIngredients } from '../../services/ingredients';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch } from '../../services/inventory-batches';
import { getChangeRequest, listChangeRequests, type ChangeRequest } from '../../services/change-requests';
import { getUsageSummary, type UsageSummary } from '../../services/usage-records';
import { formatDate, formatDateTime } from '../../utils/date-time';
import { ChangeRequestDetailsDialog } from '../application/ChangeRequestDetailsDialog';

function DashboardHeading({ userName, description, source = false, descriptionInHeader = false }: { userName: string; description?: string; source?: boolean; descriptionInHeader?: boolean }) {
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => {
    const update = () => { const hour = new Date().getHours(); setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'); };
    update(); const interval = window.setInterval(update, 30000); return () => window.clearInterval(interval);
  }, []);
  return <div className={`sl-dashboard-heading sl-dashboard-heading-v8${source ? ' sl-dashboard-source-heading' : ''}`}><PageHeader eyebrow={descriptionInHeader ? 'Overview' : 'Dashboard'} title={`${greeting}, ${userName}.`} description={descriptionInHeader ? description : undefined} />{description && !descriptionInHeader && <p className="sl-dashboard-description">{description}</p>}</div>;
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
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span><div><span>Total Users</span><strong>{userValue}</strong>{(userSummaryFailed || userSummary === null) && <small>{userSummaryFailed ? 'Account summary unavailable' : 'Loading account records'}</small>}</div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Box aria-hidden="true" /></span><div><span>Total Ingredients</span><strong>{ingredientValue}</strong>{(ingredientFailed || ingredientTotal === null) && <small>{ingredientFailed ? 'Ingredient service unavailable' : 'Loading ingredient records'}</small>}</div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Inventory Batches</span><strong>—</strong><small>Inventory batch service unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>—</strong><small>Expiration service unavailable</small></div></article>
      </section>

      <section className="sl-admin-reference-analytics" aria-label="Inventory analytics">
        <Card id="admin-ingredient-overview" title={<DashboardCardTitle Icon={Box}>Ingredient Overview</DashboardCardTitle>}><ApplicationDonutChart ariaLabel="Ingredient category overview" centerLabel="Ingredients" items={ingredientCategories ?? []} unavailableMessage={categoryStatus} /></Card>
        <Card id="admin-user-overview" title={<DashboardCardTitle Icon={UsersRound}>User Overview</DashboardCardTitle>}><ApplicationDonutChart ariaLabel="Current Admin, Manager, and Inventory Staff account totals" centerLabel="Users" items={userOverview} unavailableMessage={accountStatus} /></Card>
        <Card id="admin-inventory-overview" title={<DashboardCardTitle Icon={Boxes}>Inventory Overview</DashboardCardTitle>}><ApplicationPendingState description="Inventory status records will appear when the inventory batch service is connected." /></Card>
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
  const [valueRange, setValueRange] = useState('30');
  const [expiryRange, setExpiryRange] = useState('30');
  const [topValueRange, setTopValueRange] = useState('month');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getInventoryBatchSummary>> | null>(null);
  const [expirations, setExpirations] = useState<InventoryBatch[] | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [batchDetail, setBatchDetail] = useState<InventoryBatch | null>(null);
  const [requestDetail, setRequestDetail] = useState<ChangeRequest | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getInventoryBatchSummary(controller.signal), listInventoryBatches({ page: 1, pageSize: 5, status: 'Near Expiry', sort: 'fefo' }, controller.signal)])
      .then(([nextSummary, records]) => { if (!controller.signal.aborted) { setSummary(nextSummary); setExpirations(records.items); } })
      .catch(() => { if (!controller.signal.aborted) setInventoryError(true); });
    listChangeRequests({ page: 1, pageSize: 5, status: 'PENDING' }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRequests(result.items); })
      .catch(() => { if (!controller.signal.aborted) setRequestError(true); });
    return () => controller.abort();
  }, []);
  const pendingState = (description: string) => <div className="sl-manager-reference-state"><ApplicationPendingState description={description} /></div>;
  const openRequest = async (request: ChangeRequest, trigger: HTMLTableRowElement) => {
    requestTrigger.current = trigger;
    try { setRequestDetail(await getChangeRequest(request.id)); } catch { setRequestDetail(request); }
  };
  const recordState = (columns: number, loading: boolean, failed: boolean, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : loading ? 'Loading records' : 'No live records yet'} description={failed ? 'The service could not be reached.' : loading ? 'Retrieving current records.' : description} /></td></tr>;
  return <>
    <DashboardHeading userName={userName} description="Review inventory priorities, pending decisions, and operational risk." descriptionInHeader />
    <div className="sl-admin-view sl-manager-dashboard-v116">
      <section className="sl-sa-kpis sl-manager-kpis sl-kpi-reference-v201" aria-label="Manager inventory overview">
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso /></span><div><span>Total Inventory Value</span><strong>—</strong><small>Inventory valuation pending</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TriangleAlert /></span><div><span>Items Near Expiry (≤ 7 days)</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{inventoryError ? 'Expiration summary unavailable' : summary ? 'Batches requiring attention' : 'Loading expiration summary'}</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{inventoryError ? 'Stock summary unavailable' : summary ? 'Items at or below minimum stock' : 'Loading stock summary'}</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Forecast data pending</small></div></article>
      </section>

      <section className="sl-manager-attention-grid" aria-label="Manager attention queue">
        <Card id="manager-upcoming-expirations" title={<DashboardCardTitle Icon={CalendarClock}>Upcoming Expirations (≤ 7 days)</DashboardCardTitle>} action={<Link href="/Inventory" className="sl-text-link">View All <ArrowRight size={14}/></Link>}>
          <div className="sl-dashboard-reference-table"><table className="sl-data-table sl-reference-records-table"><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{expirations?.length ? expirations.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event => { batchTrigger.current = event.currentTarget; setBatchDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); batchTrigger.current = event.currentTarget; setBatchDetail(batch); } }}><td className="sl-emphasized-value">{batch.ingredient.name}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td></tr>) : recordState(4, expirations === null && !inventoryError, inventoryError, 'Upcoming expirations will appear when qualifying batches exist.')}</tbody></table></div>
        </Card>
        <Card id="manager-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>Pending Change Requests</DashboardCardTitle>} action={<Link href="/ChangeRequests" className="sl-text-link">Review queue <ArrowRight size={14}/></Link>}>
          <div className="sl-dashboard-reference-table"><table className="sl-data-table sl-reference-records-table"><thead><tr>{['Request ID','Type','Submitted By','Status'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{requests?.length ? requests.map(request => <tr key={request.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event => void openRequest(request, event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openRequest(request, event.currentTarget); } }}><td><span className="sl-canonical-identifier">{request.requestID}</span></td><td>{request.requestType.replaceAll('_', ' ').replace(/\b\w/g, value => value.toUpperCase())}</td><td>{request.requestedBy.name}</td><td><Status tone="attention">Pending Review</Status></td></tr>) : recordState(4, requests === null && !requestError, requestError, 'Requests awaiting review will appear here.')}</tbody></table></div>
        </Card>
      </section>

      <section className="sl-manager-reference-grid" aria-label="Manager inventory analytics">
        <Card id="manager-inventory-value" title="Inventory Value Trend" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Inventory value period</span><select value={valueRange} onChange={(event) => setValueRange(event.target.value)} aria-label="Inventory value period"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option></select></label>}>
          {pendingState('Inventory value trends will appear when valuation history is available.')}
        </Card>
        <Card id="manager-expiring-items" title="Expiring Items Trend" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Expiring items period</span><select value={expiryRange} onChange={(event) => setExpiryRange(event.target.value)} aria-label="Expiring items period"><option value="7">Next 7 Days</option><option value="14">Next 14 Days</option><option value="30">Next 30 Days</option><option value="60">Next 60 Days</option></select></label>}>
          {pendingState('Expiration trends will appear when historical batch data is available.')}
        </Card>
        <Card id="manager-stock-distribution" title="Stock Status Distribution">
          {pendingState('Stock status distribution will appear when analytics data is available.')}
        </Card>
        <Card id="manager-top-value" title="Top Ingredients by Value" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Top ingredients period</span><select value={topValueRange} onChange={(event) => setTopValueRange(event.target.value)} aria-label="Top ingredients period"><option value="week">This Week</option><option value="month">This Month</option><option value="quarter">This Quarter</option><option value="year">This Year</option></select></label>}>
          {pendingState('Ingredient value rankings will appear when valuation analytics are available.')}
        </Card>
      </section>
    </div>
    <InventoryBatchDetailsDialog batch={batchDetail} onDismiss={() => setBatchDetail(null)} returnFocus={batchTrigger} />
    <ChangeRequestDetailsDialog request={requestDetail} onDismiss={() => setRequestDetail(null)} returnFocus={requestTrigger} />
  </>;
}

function InventoryStaffDashboardContent({ userName }: { userName: string }) {
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
    listInventoryBatches({ page: 1, pageSize: 5, sort: 'fefo' }, abort.signal)
      .then(records => { if (!abort.signal.aborted) setInventory(records.items); })
      .catch(() => { if (!abort.signal.aborted) setInventoryFailed(true); });
    getInventoryBatchSummary(abort.signal)
      .then(summary => { if (!abort.signal.aborted) setInventorySummary({ totalIngredients: summary.totalIngredients, totalBatches: summary.totalBatches, nearExpiry: summary.nearExpiry, lowStockItems: summary.lowStockItems }); })
      .catch(() => { if (!abort.signal.aborted) setInventorySummaryFailed(true); });
    void listChangeRequests({ page: 1, pageSize: 10, status: 'PENDING' }, abort.signal).then(result => { if (!abort.signal.aborted) setPendingRequests(result.items); }).catch(() => { if (!abort.signal.aborted) setPendingRequestsFailed(true); });
    void getUsageSummary(abort.signal).then(result => { if (!abort.signal.aborted) setUsageSummary(result); }).catch(() => { if (!abort.signal.aborted) setUsageSummaryFailed(true); });
    return () => abort.abort();
  }, []);
  const stateRow = (columns: number, kind: 'loading' | 'empty' | 'error', title: string, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={kind} title={title} description={description} /></td></tr>;
  const requestStatus = (request: ChangeRequest) => request.status === 'PENDING' ? 'Pending Review' : request.status === 'APPROVED' ? 'Approved' : 'Rejected';
  const requestStatusTone = (request: ChangeRequest) => request.status === 'APPROVED' ? 'success' as const : request.status === 'REJECTED' ? 'critical' as const : 'attention' as const;
  const openRequest = async (id: string) => { try { setDetail(await getChangeRequest(id)); } catch { setDetail(null); } };
  const usageValue = usageSummaryFailed || usageSummary === null ? '\u2014' : usageSummary.totalUsageToday ? `${usageSummary.totalUsageToday.quantity} ${usageSummary.totalUsageToday.unit}` : usageSummary.usageRecordsToday === 0 ? '0' : '\u2014';
  const usageHelper = usageSummaryFailed ? 'Usage summary unavailable' : usageSummary === null ? 'Loading usage summary' : usageSummary.usageRecordsToday > 0 && !usageSummary.totalUsageToday ? 'Multiple units recorded today' : 'Usage quantity recorded today';

  return <div className="sl-admin-view sl-inventory-staff-dashboard-v140 sl-dashboard-source-layout">
      <DashboardHeading userName={userName} source description="Your inventory overview for today. Keep track, record accurately, and help reduce food waste." />
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-dashboard-source-kpis" aria-label="Inventory staff dashboard summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span><div><span>Today&apos;s Usage</span><strong>{usageValue}</strong><small>{usageHelper}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>{inventorySummary?.totalBatches ?? '—'}</strong><small>{inventorySummaryFailed ? 'Batch service unavailable' : 'Live inventory batches'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>{inventorySummary?.nearExpiry ?? '—'}</strong><small>{inventorySummaryFailed ? 'Expiration service unavailable' : 'Batches expiring within seven days'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList aria-hidden="true" /></span><div><span>Low Stock</span><strong>{inventorySummary?.lowStockItems ?? '—'}</strong><small>{inventorySummaryFailed ? 'Stock summary unavailable' : 'Ingredients at or below minimum stock'}</small></div></article>
      </section>

      <nav className="sl-inventory-staff-quick-actions" aria-label="Quick Actions">
        <strong>Quick Actions</strong><div><Link href="/StockIn" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Add Stock-In</Link><Link href="/UsageRecording" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Record Usage</Link><Link href="/WasteRecording" className="sl-button sl-button-primary"><Plus size={16} aria-hidden="true" />Record Waste</Link></div>
      </nav>

      <div className="sl-inventory-staff-preview-grid"><section className="sl-inventory-staff-analytics" aria-label="Use first inventory">
        <Card id="inventory-staff-fefo" title={<DashboardCardTitle Icon={ListOrdered}>Use First · FEFO</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-dashboard-source-table-shell sl-inventory-staff-fefo-table" role="region" aria-label="Use First FEFO" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table"><thead><tr>{['#','Ingredient','Batch ID','Expiration Date','Days Left'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{inventory?.length ? inventory.map((batch, index) => <tr key={batch.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{batchTrigger.current=event.currentTarget;setBatchDetail(batch)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();batchTrigger.current=event.currentTarget;setBatchDetail(batch)}}}><td>{index + 1}</td><td className="sl-emphasized-value">{batch.ingredient.name}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td></tr>) : inventoryFailed ? stateRow(5, 'error', 'Inventory unavailable', 'Inventory batches could not be loaded.') : inventory === null ? stateRow(5, 'loading', 'Loading inventory batches', 'Retrieving FEFO-priority records.') : stateRow(5, 'empty', 'No inventory batches yet', 'FEFO-priority batches will appear after stock is received.')}</tbody></table></div>
        </Card>
      </section>

      <section className="sl-inventory-staff-bottom" aria-label="Inventory staff dashboard records">
        <Card id="inventory-staff-my-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>My Pending Requests</DashboardCardTitle>} action={<Link href="/MyRequests" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-inventory-staff-dashboard-table sl-dashboard-source-table-shell" role="region" aria-label="My Pending Requests" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table sl-change-request-preview-table"><thead><tr>{['#','Request ID','Submitted On','Status'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{pendingRequests?.length ? pendingRequests.map((request, index) => <tr key={request.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{requestTrigger.current=event.currentTarget.querySelector('button');void openRequest(request.id)}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();requestTrigger.current=event.currentTarget.querySelector('button');void openRequest(request.id)}}}><td>{index + 1}</td><td><button type="button" className="sl-record-identifier-link" onClick={event => { event.stopPropagation(); requestTrigger.current = event.currentTarget; void openRequest(request.id); }}>{request.requestID}</button></td><td>{formatDateTime(request.createdAt)}</td><td><Status tone={requestStatusTone(request)}>{requestStatus(request)}</Status></td></tr>) : pendingRequestsFailed ? stateRow(4, 'error', 'Requests unavailable', 'Pending requests could not be loaded.') : pendingRequests === null ? stateRow(4, 'loading', 'Loading pending requests', 'Retrieving your submitted requests.') : stateRow(4, 'empty', 'No pending requests', 'You have no requests awaiting review.')}</tbody></table></div>
        </Card>
      </section></div>
      <InventoryBatchDetailsDialog batch={batchDetail} onDismiss={() => setBatchDetail(null)} returnFocus={batchTrigger} />
      <ChangeRequestDetailsDialog request={detail} onDismiss={() => setDetail(null)} returnFocus={requestTrigger} />
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
