import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ListChecks } from 'lucide-react';
import { useApplicationWorkspace } from '../application/ApplicationWorkspace';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from '../application/primitives';
import { ForecastFlow, WorkflowLink, WorkspaceLink } from '../application/ModulePage';
import { AccountsTable } from '../application/AccountsTable';
import { listAccounts } from '../../services/administration';

function AdminSummary() {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    listAccounts(1, 'createdAt', 'desc', abort.signal)
      .then(data => { if (!abort.signal.aborted) setTotal(data.total); })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, []);
  return <SummaryCards items={[
    { label: 'Managed accounts', value: failed ? 'Unavailable' : total === null ? 'Loading…' : total.toLocaleString(), detail: 'Manager and Inventory Staff', tone: 'brand' },
    { label: 'Ingredients', value: '—', detail: 'Preview · awaiting live data' },
    { label: 'Inventory batches', value: '—', detail: 'Preview · awaiting live data' },
    { label: 'Reports', value: '—', detail: 'Preview · awaiting live data' },
  ]} />;
}

function UnavailableSummary({ role }: { role: 'Manager' | 'Inventory Staff' }) {
  const items = role === 'Manager'
    ? ['Use-first batches', 'Low-stock items', 'Expiring batches', 'Pending requests']
    : ['Use-first batches', 'Recent transactions', 'Active alerts', 'My open requests'];
  return <PlaceholderSummaryCards items={items.map((label, index) => ({ label, tone: index === 0 ? 'attention' as const : 'neutral' as const }))} />;
}

function RolePanel({ children }: { children: ReactNode }) {
  return <div className="sl-role-panel">{children}<ArrowRight size={18} aria-hidden="true" /></div>;
}

export default function RoleDashboard() {
  const { user } = useApplicationWorkspace();
  const admin = user.role === 'Admin';
  const staff = user.role === 'Inventory Staff';
  const manager = user.role === 'Manager';
  const description = admin
    ? 'Manage operational accounts, ingredient master data and administrative oversight.'
    : manager
      ? 'Review inventory priorities, requests and decision support.'
      : 'Receive stock, record transactions and follow your submitted requests.';

  return <>
    <PageHeader eyebrow={`${user.role} · Workspace`} title={`Welcome, ${user.name}.`} description={description} />
    <div className="sl-admin-view">
      {admin ? <AdminSummary /> : <UnavailableSummary role={staff ? 'Inventory Staff' : 'Manager'} />}

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
