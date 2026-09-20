import { AlertTriangle, Bell, Boxes, CalendarDays, CheckCircle2, Filter, Info, Search, TrendingUp } from 'lucide-react';
import { Card, DataState, PageHeader, Status } from '../../components/application/primitives';
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

function BaseAlerts() {
  return <>
    <PageHeader
      eyebrow="System Controls"
      title="Alerts"
      description="Monitor and manage system alerts for expiration risks, low stock, overstock, and unusual inventory activities."
    />

    <div className="sl-admin-view sl-sa-alerts-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Alert summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Expiry Alerts</span>
            <strong>—</strong>
            <small>Awaiting expiry alerts API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div>
            <span>Low Stock Alerts</span>
            <strong>—</strong>
            <small>Awaiting low-stock alerts API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><Bell aria-hidden="true" /></span>
          <div>
            <span>Overstock Alerts</span>
            <strong>—</strong>
            <small>Awaiting overstock alerts API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success">
          <span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span>
          <div>
            <span>Forecast Deviation Alerts</span>
            <strong>—</strong>
            <small>Awaiting forecast alerts API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-alerts-layout">
        <main className="sl-sa-alerts-main">
          <section className="sl-sa-alerts-filter-card" aria-label="Alert filters">
            <label className="sl-sa-alerts-search">
              <span>Search alerts</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by ingredient, batch ID, or message…"
                  disabled
                  aria-label="Alert search unavailable until alert service is connected"
                />
              </div>
            </label>

            <label>
              <span>Alert Type</span>
              <select disabled aria-label="Alert type filter unavailable">
                <option>All Types</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select disabled aria-label="Alert status filter unavailable">
                <option>All Statuses</option>
              </select>
            </label>

            <label>
              <span>Branch</span>
              <select disabled aria-label="Branch filter unavailable">
                <option>All Branches</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-alerts-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-alerts-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-alerts-table-card" aria-label="Alert records">
            <div className="sl-sa-alerts-table-toolbar">
              <span>Alert records</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-alerts-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="System alerts"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-alerts-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live alert records are available.</span>
            </footer>
          </section>
        </main>

        <aside className="sl-sa-alerts-rail" aria-label="Alert analytics panels">
          <Card id="sa-alerts-type" title="Alerts by Type">
            <PendingPanel label="Alert type distribution" compact />
          </Card>

          <Card id="sa-alerts-status" title="Alerts by Status">
            <PendingPanel label="Alert status distribution" compact />
          </Card>

          <Card id="sa-alerts-recent" title="Recent Alerts">
            <PendingPanel label="Recent alerts" compact />
          </Card>

          <Card id="sa-alerts-settings" title="Alert Settings Overview">
            <PendingPanel label="Alert settings" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}


export default function Alerts() {
  const { user } = useApplicationWorkspace();
  return user.role === 'Manager' ? <ManagerAlerts /> : <BaseAlerts />;
}
