import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Box, Boxes, CalendarClock, ClipboardList, FileText, ListChecks, ListOrdered, PhilippinePeso, TrendingUp, TriangleAlert, UsersRound, type LucideIcon } from 'lucide-react';
import { Link } from 'expo-router';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { ApplicationDonutChart, ApplicationPendingState } from '../application/ApplicationPatterns';
import { Card, DataState, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status } from '../application/primitives';
import { ForecastFlow, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary, type DashboardSummary } from '../../services/administration';
import { listIngredientCategories, listIngredients } from '../../services/ingredients';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch } from '../../services/inventory-batches';
import { listChangeRequests, type ChangeRequest } from '../../services/change-requests';
import { formatDate, formatDateTime } from '../../utils/date-time';

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
  const [valueRange, setValueRange] = useState('30');
  const [expiryRange, setExpiryRange] = useState('30');
  const [topValueRange, setTopValueRange] = useState('month');
  const pendingState = (description: string) => <div className="sl-manager-reference-state"><DataState kind="empty" title={`${description} unavailable`} description="The supporting backend service is not connected yet." /></div>;
  return <>
    <DashboardHeading userName={userName} />
    <p className="sl-dashboard-description">Here&apos;s an overview of your inventory value, expiration risks, stock status, and pending inventory actions.</p>
    <div className="sl-admin-view sl-manager-dashboard-v116">
      <section className="sl-sa-kpis sl-manager-kpis sl-kpi-reference-v201" aria-label="Manager inventory overview">
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso /></span><div><span>Total Inventory Value</span><strong>—</strong><small>Inventory valuation pending</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TriangleAlert /></span><div><span>Items Near Expiry (≤ 7 days)</span><strong>—</strong><small>Expiration summary pending</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Low Stock Items</span><strong>—</strong><small>Stock summary pending</small></div></article>
        <article className="sl-sa-kpi sl-manager-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Forecast analytics pending</small></div></article>
      </section>

      <section className="sl-manager-reference-grid" aria-label="Manager inventory analytics and actions">
        <Card id="manager-inventory-value" title="Inventory Value Trend" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Inventory value period</span><select value={valueRange} onChange={(event) => setValueRange(event.target.value)} aria-label="Inventory value period"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option></select></label>}>
          {pendingState('Inventory value trend')}
        </Card>
        <Card id="manager-expiring-items" title="Expiring Items Trend" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Expiring items period</span><select value={expiryRange} onChange={(event) => setExpiryRange(event.target.value)} aria-label="Expiring items period"><option value="7">Next 7 Days</option><option value="14">Next 14 Days</option><option value="30">Next 30 Days</option><option value="60">Next 60 Days</option></select></label>}>
          {pendingState('Expiring items trend')}
        </Card>
        <Card id="manager-stock-distribution" title="Stock Status Distribution">
          {pendingState('Stock status distribution')}
        </Card>
        <Card id="manager-top-value" title="Top Ingredients by Value" action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Top ingredients period</span><select value={topValueRange} onChange={(event) => setTopValueRange(event.target.value)} aria-label="Top ingredients period"><option value="week">This Week</option><option value="month">This Month</option><option value="quarter">This Quarter</option><option value="year">This Year</option></select></label>}>
          {pendingState('Top ingredients by inventory value')}
        </Card>
        <Card id="manager-upcoming-expirations" title={<DashboardCardTitle Icon={CalendarClock}>Upcoming Expirations (≤ 7 days)</DashboardCardTitle>} action={<Link href="/ExpirationMonitoring" className="sl-text-link">View All <ArrowRight size={14}/></Link>}>
          <DashboardRecordTable label="Manager upcoming expirations" columns={['Ingredient','Batch ID','Expiry Date','Days Left']} />
        </Card>
        <Card id="manager-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>Pending Change Requests</DashboardCardTitle>} action={<Link href="/ChangeRequests" className="sl-text-link">View All <ArrowRight size={14}/></Link>}>
          <DashboardRecordTable label="Manager pending change requests" columns={['Request ID','Type','Submitted By','Status']} />
        </Card>
      </section>
    </div>
  </>;
}

function InventoryStaffDashboardContent({ userName }: { userName: string }) {
  const [inventory, setInventory] = useState<InventoryBatch[] | null>(null);
  const [inventorySummary, setInventorySummary] = useState<{ totalIngredients: number; totalBatches: number; nearExpiry: number; lowStockItems: number } | null>(null);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [inventorySummaryFailed, setInventorySummaryFailed] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[] | null>(null);
  const [pendingRequestsFailed, setPendingRequestsFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    listInventoryBatches({ page: 1, pageSize: 10, sort: 'fefo' }, abort.signal)
      .then(records => { if (!abort.signal.aborted) setInventory(records.items); })
      .catch(() => { if (!abort.signal.aborted) setInventoryFailed(true); });
    getInventoryBatchSummary(abort.signal)
      .then(summary => { if (!abort.signal.aborted) setInventorySummary({ totalIngredients: summary.totalIngredients, totalBatches: summary.totalBatches, nearExpiry: summary.nearExpiry, lowStockItems: summary.lowStockItems }); })
      .catch(() => { if (!abort.signal.aborted) setInventorySummaryFailed(true); });
    void listChangeRequests({ page: 1, pageSize: 10, status: 'PENDING' }, abort.signal).then(result => { if (!abort.signal.aborted) setPendingRequests(result.items); }).catch(() => { if (!abort.signal.aborted) setPendingRequestsFailed(true); });
    return () => abort.abort();
  }, []);
  const stateRow = (columns: number, kind: 'loading' | 'empty' | 'error', title: string, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={kind} title={title} description={description} /></td></tr>;

  return <div className="sl-admin-view sl-inventory-staff-dashboard-v140 sl-dashboard-source-layout">
      <DashboardHeading userName={userName} source description="Your inventory overview for today. Keep track, record accurately, and help reduce food waste." />
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-dashboard-source-kpis" aria-label="Inventory staff dashboard summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Box aria-hidden="true" /></span><div><span>Total Ingredients</span><strong>{inventorySummary?.totalIngredients ?? '—'}</strong><small>{inventorySummaryFailed ? 'Ingredient service unavailable' : 'Live ingredient records'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>{inventorySummary?.totalBatches ?? '—'}</strong><small>{inventorySummaryFailed ? 'Batch service unavailable' : 'Live inventory batches'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>{inventorySummary?.nearExpiry ?? '—'}</strong><small>{inventorySummaryFailed ? 'Expiration service unavailable' : 'Batches expiring within seven days'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList aria-hidden="true" /></span><div><span>Low Stock</span><strong>{inventorySummary?.lowStockItems ?? '—'}</strong><small>{inventorySummaryFailed ? 'Stock summary unavailable' : 'Ingredients at or below minimum stock'}</small></div></article>
      </section>

      <section className="sl-inventory-staff-analytics" aria-label="Use first inventory">
        <Card id="inventory-staff-fefo" title={<DashboardCardTitle Icon={ListOrdered}>Use First · FEFO</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-dashboard-source-table-shell sl-inventory-staff-fefo-table" role="region" aria-label="Use First FEFO" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table"><thead><tr>{['#','Ingredient','Batch ID','Expiry Date','Days Left'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{inventory?.length ? inventory.map((batch, index) => <tr key={batch.id}><td>{index + 1}</td><td className="sl-emphasized-value">{batch.ingredient.name}</td><td>{batch.batchID}</td><td>{formatDate(batch.expirationDate)}</td><td>{Math.ceil((new Date(batch.expirationDate).getTime() - Date.now()) / 86400000)}</td></tr>) : inventoryFailed ? stateRow(5, 'error', 'Inventory unavailable', 'Inventory batches could not be loaded.') : inventory === null ? stateRow(5, 'loading', 'Loading inventory batches', 'Retrieving FEFO-priority records.') : stateRow(5, 'empty', 'No inventory batches yet', 'FEFO-priority batches will appear after stock is received.')}</tbody></table></div>
        </Card>
      </section>

      <section className="sl-inventory-staff-bottom" aria-label="Inventory staff dashboard records">
        <Card id="inventory-staff-my-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>My Pending Requests</DashboardCardTitle>} action={<Link href="/MyRequests" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          <div className="sl-inventory-staff-dashboard-table sl-dashboard-source-table-shell" role="region" aria-label="My Pending Requests" tabIndex={0}><table className="sl-data-table sl-dashboard-source-table"><thead><tr>{['#','Request ID','Submitted On','Status'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{pendingRequests?.length ? pendingRequests.map((request, index) => <tr key={request.id}><td>{index + 1}</td><td>{request.requestID}</td><td>{formatDateTime(request.createdAt)}</td><td>{request.status}</td></tr>) : pendingRequestsFailed ? stateRow(4, 'error', 'Requests unavailable', 'Pending requests could not be loaded.') : pendingRequests === null ? stateRow(4, 'loading', 'Loading pending requests', 'Retrieving your submitted requests.') : stateRow(4, 'empty', 'No pending requests', 'You have no requests awaiting review.')}</tbody></table></div>
        </Card>
      </section>
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
