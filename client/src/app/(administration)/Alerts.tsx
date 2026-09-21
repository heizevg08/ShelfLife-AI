import { AlertTriangle, Bell, Boxes, CalendarDays, CheckCircle2, Eye, FileText, Filter, Info, Pencil, Search, Trash2, TrendingUp } from 'lucide-react';
import { Card, DataState, ExportControl, PageHeader, Pagination, Status } from '../../components/application/primitives';
import { Dialog } from '../../components/application/Dialog';
import { useState } from 'react';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

function PendingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-sa-alerts-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={label}
        action={<Status>Preview · data pending</Status>}
      />
    </div>
  );
}



function ManagerAlertPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-manager-alerts-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={label}
        action={<Status>Preview · data pending</Status>}
      />
    </div>
  );
}

function ManagerAlerts() {
  return <>
    <PageHeader
      title="Alerts"
      description="Stay ahead of risks. Monitor important inventory, expiration, and forecast alerts for your branch."
    />

    <div className="sl-admin-view sl-manager-alerts-v134">
      <section className="sl-manager-alerts-kpis" aria-label="Alert summary">
        <article className="sl-manager-alerts-kpi" data-tone="critical">
          <span className="sl-manager-alerts-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div><span>Expiring Soon</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-manager-alerts-kpi" data-tone="attention">
          <span className="sl-manager-alerts-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div><span>Low Stock</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-manager-alerts-kpi" data-tone="brand">
          <span className="sl-manager-alerts-kpi-icon"><TrendingUp aria-hidden="true" /></span>
          <div><span>Forecast Risk</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-manager-alerts-kpi" data-tone="neutral">
          <span className="sl-manager-alerts-kpi-icon"><Info aria-hidden="true" /></span>
          <div><span>Other Alerts</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
      </section>

      <div className="sl-manager-alerts-layout">
        <main className="sl-manager-alerts-main">
          <section className="sl-manager-alerts-records-card" aria-label="Alert records">
            <nav className="sl-manager-alerts-tabs" aria-label="Alert categories">
              {['All Alerts', 'Expiring Soon', 'Low Stock', 'Forecast Risk', 'Other'].map((label, index) => (
                <button key={label} type="button" className={index === 0 ? 'active' : ''} disabled>{label}</button>
              ))}
            </nav>

            <div className="sl-manager-alerts-filters" aria-label="Alert filters">
              <label className="sl-manager-alerts-search">
                <span className="sl-sr-only">Search alerts</span>
                <div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search alerts..." disabled /></div>
              </label>
              <label><span>Alert Type</span><select disabled><option>All Types</option></select></label>
              <label><span>Priority</span><select disabled><option>All Priorities</option></select></label>
              <label><span>Location</span><select disabled><option>All Locations</option></select></label>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>

            <div className="sl-manager-alerts-table-wrap">
              <table className="sl-manager-alerts-table">
                <thead><tr>
                  <th aria-label="Select"></th>
                  <th>Date &amp; Time</th>
                  <th>Ingredient</th>
                  <th>Alert Type</th>
                  <th>Details</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr></thead>
              </table>
              <div className="sl-manager-alerts-table-state">
                <ManagerAlertPending label="Alert records" />
              </div>
            </div>

            <footer className="sl-manager-alerts-footer">
              <label><span>Rows per page</span><select defaultValue="10" disabled><option>10</option></select></label>
              <span>Pagination will activate when live alert records are available.</span>
            </footer>
          </section>
        </main>

        <aside className="sl-manager-alerts-rail" aria-label="Alert analytics">
          <Card id="manager-alert-trends" title="Alert Trends">
            <div className="sl-manager-alerts-card-select"><select defaultValue="Last 30 Days" disabled><option>Last 30 Days</option></select></div>
            <ManagerAlertPending label="Alert trends" compact />
          </Card>
          <Card id="manager-alert-priority" title="Alerts by Priority">
            <ManagerAlertPending label="Alert priority distribution" compact />
          </Card>
          <Card id="manager-alert-resolved" title="Recent Resolved Alerts">
            <ManagerAlertPending label="Resolved alerts" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}

function SuperAdminAlerts() {
  const [alertSearch, setAlertSearch] = useState('');
  const [alertType, setAlertType] = useState('All Types');
  const [alertStatus, setAlertStatus] = useState('All Statuses');
  const [alertDateRange, setAlertDateRange] = useState('any');
  const [alertDateFrom, setAlertDateFrom] = useState('');
  const [alertDateTo, setAlertDateTo] = useState('');
  const [alertRows, setAlertRows] = useState(10);
  const [alertPage, setAlertPage] = useState(1);
  const [alertAction, setAlertAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetAlertFilters = () => {
    setAlertSearch('');
    setAlertType('All Types');
    setAlertStatus('All Statuses');
    setAlertDateRange('any');
    setAlertDateFrom('');
    setAlertDateTo('');
    setAlertPage(1);
  };

  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Alerts"
      description="Monitor and manage system alerts for expiration risks, low stock, overstock, and unusual inventory activities."
    />

    <div className="sl-admin-view sl-sa-alerts-page sl-sa-batches-page sl-sa-ingredients-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Alert summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Bell aria-hidden="true" /></span><div><span>Overstock Alerts</span><strong>—</strong><small>Awaiting overstock alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span><div><span>Forecast Alerts</span><strong>—</strong><small>Awaiting forecast alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Low Stock Alerts</span><strong>—</strong><small>Awaiting low-stock alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>Expiry Alerts</span><strong>—</strong><small>Awaiting expiry alerts API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-batches-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-batches-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records" aria-label="Alert records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Alert Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Alert filters">
                <label className="sl-sa-ingredients-search"><span>Search alerts</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by alert ID or ingredient…" value={alertSearch} onChange={event => setAlertSearch(event.target.value)} /></div></label>
                <label><span>Alert Type</span><select value={alertType} onChange={event => { setAlertType(event.target.value); setAlertPage(1); }}><option>All Types</option><option>Expiry</option><option>Low Stock</option><option>Overstock</option><option>Forecast Deviation</option></select></label>
                <label><span>Status</span><select value={alertStatus} onChange={event => { setAlertStatus(event.target.value); setAlertPage(1); }}><option>All Statuses</option><option>Active</option><option>Acknowledged</option><option>Resolved</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={alertDateRange} onChange={event => { setAlertDateRange(event.target.value); setAlertPage(1); }} aria-label="Alert date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {alertDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom alert date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={alertDateFrom} max={alertDateTo || undefined} onChange={event => { setAlertDateFrom(event.target.value); setAlertPage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={alertDateTo} min={alertDateFrom || undefined} onChange={event => { setAlertDateTo(event.target.value); setAlertPage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetAlertFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-alerts-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Alert records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Alert ID</th><th scope="col">Ingredient</th><th scope="col">Avg. Daily Usage</th><th scope="col">Alert Type</th><th scope="col">Severity</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row"><td colSpan={7}><DataState kind="empty" title="No live records yet" description="Alert records will appear here when the alerts backend is connected." /></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Alert actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View alert" title="View" onClick={() => setAlertAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit alert" title="Edit" onClick={() => setAlertAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete alert" title="Delete" onClick={() => setAlertAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={alertRows} aria-label="Rows per page" onChange={event => { setAlertRows(Number(event.target.value)); setAlertPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <span className="sl-staff-usage-pagination-note">No live records yet</span>
              <Pagination compact page={alertPage} pageSize={alertRows} total={0} itemLabel="alerts" onPageChange={setAlertPage} />
            </div>
          </section>
        </main>
      </div>
    </div>

    <Dialog open={alertAction!==null} title={alertAction==='delete'?'Confirm Delete':alertAction==='edit'?'Edit Alert':'Alert Details'} onDismiss={() => setAlertAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={alertAction==='delete'?'A live alert is required before deletion can be confirmed.':alertAction==='edit'?'A live alert is required before editing.':'Alert details will appear here when live records are available.'} /></div>
      {alertAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setAlertAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live alert">Confirm Delete</button></div>}
    </Dialog>
  </>;
}

function BaseAlerts() {
  return <>
    <div className="sl-sa-usage-heading">
      <header className="sl-page-header sl-sa-usage-page-header">
        <p className="sl-eyebrow">System Oversight</p>
        <h1 className="sl-page-title">Alerts</h1>
        <p className="sl-description sl-sa-usage-description" style={{ whiteSpace: 'nowrap', maxWidth: 'none', width: 'max-content' }}>
          Monitor and manage system alerts for expiration risks, low stock, overstock, and unusual inventory activities.
        </p>
      </header>
    </div>

    <div className="sl-admin-view sl-sa-alerts-page sl-sa-usage-page sl-sa-ingredients-page sl-sa-usage-inventory-pattern sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-sa-usage-kpis" aria-label="Alert summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>Expiry Alerts</span><strong>—</strong><small>Awaiting expiry alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Low Stock Alerts</span><strong>—</strong><small>Awaiting low-stock alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Bell aria-hidden="true" /></span><div><span>Overstock Alerts</span><strong>—</strong><small>Awaiting overstock alerts API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span><div><span>Forecast Deviation Alerts</span><strong>—</strong><small>Awaiting forecast alerts API</small></div></article>
      </section>

      <div className="sl-sa-alerts-layout sl-sa-ingredients-layout sl-sa-usage-ingredients-layout">
        <main className="sl-sa-alerts-main sl-sa-ingredients-main sl-sa-usage-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records" aria-label="Alert records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><Bell aria-hidden="true" /></span><h2>Alert Records</h2></header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Alert filters">
                <label className="sl-sa-ingredients-search"><span>Search alerts</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by ingredient, batch ID, or message…" /></div></label>
                <label><span>Alert Type</span><select defaultValue="All Types"><option>All Types</option><option>Expiry</option><option>Low Stock</option><option>Overstock</option><option>Forecast Deviation</option></select></label>
                <label><span>Status</span><select defaultValue="All Statuses"><option>All Statuses</option><option>Active</option><option>Acknowledged</option><option>Resolved</option></select></label>
                <label><span>Branch</span><select defaultValue="All Branches"><option>All Branches</option><option disabled>Branch values · data pending</option></select></label>
                <label><span>Date Range</span><select defaultValue="Any date"><option>Any date</option><option>Last week</option><option>Last month</option><option>Last year</option><option>Custom</option></select></label>
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button">Reset</button><button type="button" className="sl-button">Export</button></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-wrap sl-staff-usage-table-wrap">
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table sl-sa-alerts-record-table">
                <thead><tr><th>Alert ID</th><th>Ingredient</th><th>Avg. Daily Usage</th><th>Alert Type</th><th>Severity</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody><tr className="sl-sa-alerts-empty-row"><td colSpan={8}><div className="sl-sa-alerts-inline-empty"><Bell size={18} aria-hidden="true" /><span>Awaiting live alert records.</span></div></td></tr></tbody>
              </table>
            </div>

            <footer className="sl-sa-ingredients-table-footer sl-staff-usage-table-footer">
              <label><span>Rows per page</span><select defaultValue="10"><option>10</option><option>15</option><option>50</option><option>100</option><option>150</option></select></label>
              <div className="sl-sa-ingredients-pagination" aria-label="Alert pagination"><button type="button" className="sl-button" disabled>Previous</button><span>Page 1</span><button type="button" className="sl-button" disabled>Next</button></div>
            </footer>
          </section>
        </main>

        <aside className="sl-sa-alerts-rail sl-sa-usage-rail" aria-label="Alert analytics panels">
          <Card id="sa-alerts-type" title="Alerts by Type">
            <div className="sl-sa-alert-chart-shell" aria-label="Alerts by type chart structure">
              <div className="sl-sa-alert-chart-legend"><span><i className="tone-expiry" />Expiry</span><span><i className="tone-stock" />Low Stock</span><span><i className="tone-overstock" />Overstock</span><span><i className="tone-forecast" />Forecast Deviation</span></div>
              <div className="sl-sa-alert-donut" aria-hidden="true"><div className="sl-sa-alert-donut-hole">—</div></div>
              <p>Awaiting live alert type data.</p>
            </div>
          </Card>

          <Card id="sa-alerts-status" title="Alerts by Status">
            <div className="sl-sa-alert-bars-shell" aria-label="Alerts by status chart structure">
              <div className="sl-sa-alert-bars-axis"><span>Status</span><span>Alert Count</span></div>
              <div className="sl-sa-alert-bar-row"><span>Active</span><i /><strong>—</strong></div>
              <div className="sl-sa-alert-bar-row"><span>Acknowledged</span><i /><strong>—</strong></div>
              <div className="sl-sa-alert-bar-row"><span>Resolved</span><i /><strong>—</strong></div>
              <p>Awaiting live alert status data.</p>
            </div>
          </Card>

          <Card id="sa-alerts-recent" title="Alert Trend" action={<label className="sl-sa-alerts-chart-period"><span className="sr-only">Alert trend period</span><select defaultValue="14"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option></select></label>}>
            <div className="sl-sa-alert-trend-shell" aria-label="Alert trend chart structure">
              <div className="sl-sa-alert-trend-frame"><div className="sl-sa-alert-trend-y"><span className="sl-sa-alert-axis-title">Alert Count</span></div><div className="sl-sa-alert-trend-grid"><i/><i/><i/><i/><i/></div><div className="sl-sa-alert-trend-preview"><i/><i/></div><div className="sl-sa-alert-trend-empty">Awaiting live alert trend data.</div></div>
              <div className="sl-sa-alert-trend-x"><span className="sl-sa-alert-axis-title">Date</span></div>
            </div>
          </Card>

          <Card id="sa-alerts-settings" title="Alert Settings Overview">
            <div className="sl-sa-alert-settings-shell">
              <div><span>Expiry Alerts</span><strong>—</strong></div><div><span>Low Stock Alerts</span><strong>—</strong></div><div><span>Overstock Alerts</span><strong>—</strong></div><div><span>Forecast Deviation</span><strong>—</strong></div>
              <p>Awaiting live alert settings.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  </>;
}


export default function Alerts() {
  const { user } = useApplicationWorkspace();
  if (user.role === 'Manager') return <ManagerAlerts />;
  if (user.role === 'Super Admin') return <SuperAdminAlerts />;
  return <BaseAlerts />;
}
