import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ListChecks } from 'lucide-react';
import { Link } from 'expo-router';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from '../application/primitives';
import { ForecastFlow, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { accountSummary } from '../../services/administration';
import { AuditTable } from '../application/AuditTable';
import { sessionDisplayName } from '../../services/auth';

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
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    accountSummary(abort.signal)
      .then(data => { if (!abort.signal.aborted) setTotal(data.activeUsers); })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, []);

  return <>
    <DashboardHeading userName={userName} />
    <p className="sl-dashboard-description">Monitor operational activity, ingredient data, analytics and administrative oversight.</p>
    <div className="sl-admin-view sl-admin-dashboard-v17">
      <SummaryCards items={[
        { label: 'Active Users', value: failed ? 'Unavailable' : total === null ? 'Loading…' : total.toLocaleString(), detail: 'Active establishment accounts', tone: 'brand', trend: 'line' },
        { label: 'Open alerts', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting alert service', tone: 'attention', trend: 'bars' },
        { label: 'Pending requests', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting request service', tone: 'critical', trend: 'segments' },
        { label: 'Audit events today', value: <span className="sl-placeholder-value">—</span>, detail: 'Live events appear in Audit Logs', tone: 'success', trend: 'accuracy' },
      ]} />

      <div className="sl-admin-insight-grid">
        <Card id="admin-recent-audit" title="Recent Audit Logs" action={<Link href="/AdministrativeAudit" className="sl-text-link">View all logs <ArrowRight size={15} aria-hidden="true" /></Link>}>
          <AuditTable recent />
        </Card>
        <Card id="admin-change-requests" title="Change Requests">
          <div className="sl-request-preview sl-admin-request-preview">
            <div className="sl-request-donut" role="img" aria-label="Change request data awaiting request service">
              <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="sl-request-donut-track" cx="60" cy="60" r="44" /><circle className="sl-request-donut-segment sl-request-donut-success" cx="60" cy="60" r="44" pathLength="100" /><circle className="sl-request-donut-segment sl-request-donut-attention" cx="60" cy="60" r="44" pathLength="100" /><circle className="sl-request-donut-segment sl-request-donut-critical" cx="60" cy="60" r="44" pathLength="100" /></svg>
              <strong aria-hidden="true">—</strong>
            </div>
            <div className="sl-preview-legend"><span><i className="sl-dot sl-dot-success" /> Approved <strong>—</strong></span><span><i className="sl-dot sl-dot-attention" /> Pending <strong>—</strong></span><span><i className="sl-dot sl-dot-critical" /> Rejected <strong>—</strong></span></div>
            <p className="sl-supporting">Awaiting request service</p>
          </div>
        </Card>
      </div>

      <section aria-labelledby="admin-analytics-title" className="sl-admin-section">
        <div className="sl-section-heading"><div><p className="sl-eyebrow">Analytics</p><h2 id="admin-analytics-title" className="sl-section-title">Waste and Forecast Analytics</h2></div></div>
        <div className="sl-analytics-preview-grid">
          <article className="sl-analytics-preview-card" data-tone="attention">
            <h3>Weekly Waste Cost</h3>
            <div className="sl-analytics-unavailable"><strong>Unavailable</strong><span className="sl-supporting">Awaiting waste analytics service</span></div>
          </article>
          <article className="sl-analytics-preview-card" data-tone="success">
            <div className="sl-analytics-card-heading"><h3>Forecast Accuracy</h3></div>
            <div className="sl-analytics-unavailable"><strong>Unavailable</strong><span className="sl-supporting">Awaiting forecast analytics service</span></div>
          </article>
          <article className="sl-analytics-preview-card" data-tone="critical">
            <div className="sl-analytics-card-heading"><h3>30-Day Waste Value</h3></div>
            <div className="sl-analytics-unavailable"><strong>Unavailable</strong><span className="sl-supporting">Awaiting waste analytics service</span></div>
          </article>
        </div>
      </section>
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
