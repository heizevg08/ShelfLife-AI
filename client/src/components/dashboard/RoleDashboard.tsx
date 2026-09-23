import { useEffect, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, Box, Boxes, CalendarClock, ClipboardList, ListChecks, ListOrdered, PhilippinePeso, TrendingUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'expo-router';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { Card, DataState, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status } from '../application/primitives';
import { ForecastFlow, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary } from '../../services/administration';
import { listIngredients } from '../../services/ingredients';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';

function DashboardHeading({ userName, description, source = false }: { userName: string; description?: string; source?: boolean }) {
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => {
    const update = () => { const hour = new Date().getHours(); setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'); };
    update(); const interval = window.setInterval(update, 30000); return () => window.clearInterval(interval);
  }, []);
  return <div className={`sl-dashboard-heading sl-dashboard-heading-v8${source ? ' sl-dashboard-source-heading' : ''}`}><PageHeader eyebrow="Dashboard" title={`${greeting}, ${userName}.`} />{description && <p className="sl-dashboard-description">{description}</p>}</div>;
}

function DashboardCardTitle({ Icon, children }: { Icon: LucideIcon; children: ReactNode }) {
  return <span className="sl-dashboard-card-heading"><span className="sl-staff-usage-head-icon"><Icon aria-hidden="true" /></span><span>{children}</span></span>;
}

function DashboardRecordTable({ label, columns }: { label: string; columns: string[] }) {
  return <div className="sl-dashboard-reference-table" role="region" aria-label={label} tabIndex={0}><table className="sl-data-table sl-reference-records-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody><tr aria-label={`${label} unavailable`}>{columns.map(column => <td key={column}>—</td>)}</tr></tbody></table></div>;
}

function AdminDashboardContent({ userName }: { userName: string }) {
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientFailed, setIngredientFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setIngredientFailed(false);
    listIngredients(1, 1, '', '', abort.signal)
      .then(data => { if (!abort.signal.aborted) setIngredientTotal(data.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientFailed(true); });
    return () => abort.abort();
  }, []);

  const ingredientValue = ingredientFailed ? 'Unavailable' : ingredientTotal === null ? 'Loading…' : ingredientTotal.toLocaleString();
  const pendingState = (description: string) => <div className="sl-admin-reference-state"><DataState kind="empty" title={`${description} unavailable`} description="The supporting backend service is not connected yet." /></div>;

  return <>
    <DashboardHeading userName={userName} />
    <p className="sl-dashboard-description">Here&apos;s an overview of your establishment&apos;s inventory and ingredient status.</p>
    <div className="sl-admin-view sl-admin-dashboard-v103">
      <section className="sl-sa-kpis sl-admin-reference-kpis sl-kpi-reference-v201" aria-label="Establishment inventory overview">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Total Ingredients</span><strong>{ingredientValue}</strong><small>{ingredientFailed ? 'Ingredient service unavailable' : ingredientTotal === null ? 'Loading ingredient records' : 'Live ingredient records'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TriangleAlert /></span><div><span>Low Stock Items</span><strong>—</strong><small>Inventory summary pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TriangleAlert /></span><div><span>Expiring Soon</span><strong>—</strong><small>Expiration summary pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ListChecks /></span><div><span>Total Waste (This Month)</span><strong>—</strong><small>Waste summary pending</small></div></article>
      </section>

      <section className="sl-admin-reference-analytics" aria-label="Inventory analytics">
        <Card id="admin-inventory-value" title={<DashboardCardTitle Icon={TrendingUp}>Inventory Value Trend</DashboardCardTitle>} action={<Status>Last 30 days</Status>}>{pendingState('Inventory value trend')}</Card>
        <Card id="admin-stock-status" title={<DashboardCardTitle Icon={Boxes}>Ingredient Stock Status</DashboardCardTitle>}>{pendingState('Ingredient stock status')}</Card>
        <Card id="admin-waste-breakdown" title={<DashboardCardTitle Icon={ListChecks}>Waste Breakdown (This Month)</DashboardCardTitle>}>{pendingState('Waste breakdown')}</Card>
      </section>

      <section className="sl-admin-reference-pairs">
        <Card id="admin-upcoming-expirations" title={<DashboardCardTitle Icon={CalendarClock}>Upcoming Expirations</DashboardCardTitle>} action={<Link href="/ExpirationMonitoring" className="sl-text-link">View all <ArrowRight size={14}/></Link>}><DashboardRecordTable label="Upcoming expirations" columns={['Ingredient','Batch ID','Expiry Date','Days Left']} /></Card>
        <Card id="admin-low-stock" title={<DashboardCardTitle Icon={TriangleAlert}>Low Stock Items</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View all <ArrowRight size={14}/></Link>}><DashboardRecordTable label="Low stock items" columns={['Ingredient','Current Stock','Unit','Status']} /></Card>
      </section>

      <section className="sl-admin-reference-pairs">
        <Card id="admin-recent-activity" title={<DashboardCardTitle Icon={Activity}>Recent User Activity</DashboardCardTitle>} action={<Link href="/AdministrativeAudit" className="sl-text-link">View all <ArrowRight size={14}/></Link>}><AuditTable recent /></Card>
        <Card id="admin-inventory-overview" title={<DashboardCardTitle Icon={Boxes}>Inventory Overview</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View all <ArrowRight size={14}/></Link>}>{pendingState('Inventory category overview')}</Card>
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
  const [timelineRange, setTimelineRange] = useState('30');
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientFailed, setIngredientFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    listIngredients(1, 1, '', '', abort.signal)
      .then(result => { if (!abort.signal.aborted) setIngredientTotal(result.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientFailed(true); });
    return () => abort.abort();
  }, []);
  const ingredientValue = ingredientTotal === null ? '—' : ingredientTotal.toLocaleString();
  const dashTable = (label: string, columns: string[], fitCard = false) => <div className={fitCard ? 'sl-dashboard-source-table-shell sl-inventory-staff-fefo-table' : 'sl-inventory-staff-dashboard-table sl-dashboard-source-table-shell'} role="region" aria-label={label} tabIndex={0}><table className="sl-data-table sl-dashboard-source-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody><tr>{columns.map(column => <td key={column}>—</td>)}</tr></tbody></table></div>;

  return <div className="sl-admin-view sl-inventory-staff-dashboard-v140 sl-dashboard-source-layout">
      <DashboardHeading userName={userName} source description="Your inventory overview for today. Keep track, record accurately, and help reduce food waste." />
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-dashboard-source-kpis" aria-label="Inventory staff dashboard summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Box aria-hidden="true" /></span><div><span>Total Ingredients</span><strong>{ingredientValue}</strong><small>{ingredientTotal !== null ? 'Live ingredient records' : ingredientFailed ? 'Ingredient service unavailable' : 'Loading ingredient records'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>—</strong><small>Batch service unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TriangleAlert aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>—</strong><small>Expiration service unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList aria-hidden="true" /></span><div><span>Low Stock</span><strong>—</strong><small>Stock summary unavailable</small></div></article>
      </section>

      <section className="sl-inventory-staff-analytics" aria-label="Inventory staff dashboard analytics">
        <Card
          id="inventory-staff-expiration-timeline"
          title={<DashboardCardTitle Icon={CalendarClock}>Expiration Timeline</DashboardCardTitle>}
          action={<label className="sl-dashboard-filter"><span className="sl-sr-only">Expiration timeline period</span><select value={timelineRange} onChange={(event) => setTimelineRange(event.target.value)} aria-label="Expiration timeline period"><option value="7">Next 7 Days</option><option value="14">Next 14 Days</option><option value="30">Next 30 Days</option><option value="60">Next 60 Days</option></select></label>}
        >
          <div className="sl-inventory-staff-expiration-chart" role="img" aria-label="Expiration timeline by days until expiration and batch count; live values unavailable">
            <span className="sl-inventory-staff-y-title">Batch Count</span>
            <div className="sl-inventory-staff-chart-y" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
            <div className="sl-inventory-staff-bar-plot" aria-hidden="true">{Array.from({ length: 4 }).map((_, index) => <i key={index} />)}</div>
            <div className="sl-inventory-staff-chart-x" aria-hidden="true"><span>0–7 Days</span><span>8–14 Days</span><span>15–30 Days</span><span>31–60 Days</span></div>
            <span className="sl-inventory-staff-x-title">Days Until Expiration</span>
            <span className="sl-inventory-staff-chart-note">Expiration data unavailable</span>
          </div>
        </Card>
        <Card id="inventory-staff-stock-status" title={<DashboardCardTitle Icon={Boxes}>Stock Level Status</DashboardCardTitle>}>
          <div className="sl-inventory-staff-stock-chart">
            <div className="sl-inventory-staff-stock-donut" aria-hidden="true"><strong>—</strong><span>Batches</span></div>
            <div className="sl-inventory-staff-stock-legend" aria-label="Stock status legend">{['In Stock', 'Low Stock', 'Near Expiry', 'Expired'].map((label, index) => <div key={label}><i data-index={index}/><span>{label}</span><strong>—</strong></div>)}</div>
          </div>
        </Card>
        <Card id="inventory-staff-fefo" title={<DashboardCardTitle Icon={ListOrdered}>Use First · FEFO</DashboardCardTitle>} action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          {dashTable('Use First FEFO', ['#', 'Ingredient', 'Batch ID', 'Expiry Date', 'Days Left'], true)}
        </Card>
      </section>

      <section className="sl-inventory-staff-bottom" aria-label="Inventory staff dashboard records">
        <Card id="inventory-staff-my-pending-requests" title={<DashboardCardTitle Icon={ClipboardList}>My Pending Requests</DashboardCardTitle>} action={<Link href="/MyRequests" className="sl-text-link">View All <ArrowRight size={14} /></Link>}>
          {dashTable('My Pending Requests', ['#', 'Request ID', 'Submitted On', 'Status'])}
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
