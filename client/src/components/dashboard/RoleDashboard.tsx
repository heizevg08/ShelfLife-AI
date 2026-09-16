import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ListChecks, TriangleAlert } from 'lucide-react';
import { Link } from 'expo-router';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from '../application/primitives';
import { ForecastFlow, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary } from '../../services/administration';
import { listIngredients } from '../../services/ingredients';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';
import { WasteForecastAnalytics } from '../shared/dashboard/WasteForecastAnalytics';

function DashboardHeading({ userName }: { userName: string }) {
  const [clock, setClock] = useState(() => new Date());
  const [greeting, setGreeting] = useState('Welcome');
  useEffect(() => {
    const update = () => {
      const now = new Date(); setClock(now);
      const hour = now.getHours();
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    };
    update(); const interval = window.setInterval(update, 30000);
    return () => window.clearInterval(interval);
  }, []);
  const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(clock);
  return <div className="sl-dashboard-heading sl-dashboard-heading-v8"><PageHeader eyebrow="Dashboard" title={`${greeting}, ${userName}.`} /><time className="sl-dashboard-datetime" dateTime={clock.toISOString()}>{label}</time></div>;
}

function AdminDashboardContent({ userName }: { userName: string }) {
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientFailed, setIngredientFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    listIngredients(1, 1, '', '', abort.signal)
      .then(data => { if (!abort.signal.aborted) setIngredientTotal(data.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientFailed(true); });
    return () => abort.abort();
  }, []);

  const ingredientValue = ingredientFailed ? 'Unavailable' : ingredientTotal === null ? 'Loading…' : ingredientTotal.toLocaleString();
  return <>
    <DashboardHeading userName={userName} />
    <p className="sl-dashboard-description">Monitor operational activity, ingredient data, analytics and administrative oversight.</p>
    <div className="sl-admin-view sl-superadmin-dashboard sl-admin-dashboard-v30">
      <SummaryCards items={[
        { label: 'Total Ingredients', value: ingredientValue, detail: ingredientFailed ? 'Ingredient service unavailable' : 'Live ingredient records', tone: 'brand', trend: 'line' },
        { label: 'Total Inventory Batches', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting inventory batch service', tone: 'success', trend: 'accuracy' },
        { label: 'Items Expiring Soon (≤ 3 days)', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting expiration service', tone: 'attention', trend: 'bars' },
        { label: 'Expired Items', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting expiration service', tone: 'critical', trend: 'segments' },
      ]} />

      <section className="sl-admin-inventory-grid" aria-label="Inventory dashboard analytics">
        <Card id="admin-inventory-category" title="Inventory Status by Category"><div className="sl-reference-empty-chart"><div className="sl-inventory-donut" aria-label="Inventory category distribution awaiting analytics data"><svg viewBox="0 0 42 42" aria-hidden="true"><circle className="sl-inventory-donut-track" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-produce" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-meat" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-dairy" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-dry" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-condiments" cx="21" cy="21" r="15.9155"/><circle className="sl-inventory-donut-segment sl-inventory-donut-others" cx="21" cy="21" r="15.9155"/></svg><span><strong>{ingredientValue === 'Loading…' || ingredientValue === 'Unavailable' ? '—' : ingredientValue}</strong><small>Ingredients</small></span></div><div className="sl-reference-legend"><span><i/>Produce <b>—</b></span><span><i/>Meat <b>—</b></span><span><i/>Dairy <b>—</b></span><span><i/>Dry Goods <b>—</b></span><span><i/>Condiments <b>—</b></span><span><i/>Others <b>—</b></span></div></div><p className="sl-dashboard-empty-note">Category totals require inventory analytics data.</p></Card>
        <Card id="admin-expiration-trend" title="Expiration Trend"><div className="sl-expiration-shell" aria-label="Expiration trend awaiting service"><div className="sl-chart-gridlines"/><div className="sl-chart-placeholder-bars">{[2,3,2,3,5,4,3].map((h,i)=><i key={i} style={{height:`${h*12}px`}} />)}</div><div className="sl-chart-labels"><span>Day 1</span><span>Day 3</span><span>Day 5</span><span>Day 7</span></div></div><p className="sl-dashboard-empty-note">Awaiting expiration analytics service</p></Card>
        <Card id="admin-low-stock" title="Low Stock Ingredients" action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={15}/></Link>}><div className="sl-low-stock-empty"><TriangleAlert size={25}/><strong>No live low-stock summary yet</strong><span>Stock thresholds will appear when inventory batches are connected.</span></div></Card>
      </section>

      <section className="sl-admin-activity-grid sl-admin-activity-grid-single">
        <Card id="admin-recent-activity" title="Recent Activity" action={<Link href="/AdministrativeAudit" className="sl-text-link">View All <ArrowRight size={15}/></Link>}><AuditTable recent /></Card>
      </section>
      <WasteForecastAnalytics />
    </div>
  </>;
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
        <Card id="role-primary" title={admin ? 'Operational account directory' : 'Batch inventory'} action={<WorkspaceLink to={admin ? '/UserManagement' : '/InventoryBatches'}>View all</WorkspaceLink>}>
          {admin ? <AccountsTable /> : <PlaceholderTable
            label={admin ? 'Operational account preview' : 'Inventory overview'}
            columns={admin ? ['Name', 'Email', 'Role', 'Status'] : ['Ingredient', 'Batch', 'Quantity', 'Expiration', 'Status']}
            description={admin ? 'Manager and Inventory Staff accounts' : 'Batch-level stock ordered for review'}
          />}
        </Card>
        <Card id="role-secondary" title={admin ? 'Ingredient master data' : staff ? 'My requests' : 'Change requests'} action={<ListChecks size={18} aria-hidden="true" />}>
          <RolePanel><div><Status>Preview · data pending</Status><p className="sl-supporting">{admin ? 'Ingredients remain separate from received inventory batches.' : staff ? 'Your submitted corrections will appear here.' : 'Requests awaiting Manager review will appear here.'}</p>
            <WorkspaceLink to={admin ? '/Ingredients' : '/ChangeRequests'}>{admin ? 'Open ingredients' : 'Open requests'}</WorkspaceLink></div></RolePanel>
        </Card>
      </div>

      {manager && <ForecastFlow />}
      <section aria-labelledby="role-actions"><div className="sl-section-heading"><h2 id="role-actions" className="sl-section-title">{staff ? 'Daily actions' : 'Workspace tools'}</h2></div>
        <div className={`sl-workflow-links${staff ? ' sl-workflow-links-three' : ''}`}>
          {admin ? <><WorkflowLink to="/AdministrativeAudit" title="Audit Logs" description="Review administrative account changes." /><WorkflowLink to="/Reports" title="Reports & Analytics" description="Open the reporting workspace." /></>
            : staff ? <><WorkflowLink to="/StockIn" title="Stock-In" description="Receive a batch against an ingredient." /><WorkflowLink to="/Usage" title="Record usage" description="Log quantities consumed from a batch." /><WorkflowLink to="/Waste" title="Record waste" description="Log discarded quantities and reasons." /></>
            : <><WorkflowLink to="/UsageWaste" title="Usage & Waste" description="Review consumption and loss transactions." /><WorkflowLink to="/Alerts" title="Alerts" description="Review inventory and expiration attention." /></>}
        </div>
      </section>
    </div>
  </>;
}
