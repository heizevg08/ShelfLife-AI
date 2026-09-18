import { AlertTriangle, Bell, Boxes, CalendarDays, Filter, Search, TrendingUp } from 'lucide-react';
import { Card, DataState, PageHeader, Status } from '../../components/application/primitives';

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

export default function Alerts() {
  return <>
    <PageHeader
      eyebrow="System Controls"
      title="Alerts"
      description="Monitor and manage system alerts for expiration risks, low stock, overstock, and unusual inventory activities."
    />

    <div className="sl-admin-view sl-sa-alerts-page">
      <section className="sl-sa-alerts-kpis" aria-label="Alert summary">
        <article className="sl-sa-alerts-kpi" data-tone="critical">
          <span className="sl-sa-alerts-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Expiry Alerts</span>
            <strong>—</strong>
            <small>Awaiting expiry alerts API</small>
          </div>
        </article>

        <article className="sl-sa-alerts-kpi" data-tone="attention">
          <span className="sl-sa-alerts-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div>
            <span>Low Stock Alerts</span>
            <strong>—</strong>
            <small>Awaiting low-stock alerts API</small>
          </div>
        </article>

        <article className="sl-sa-alerts-kpi" data-tone="brand">
          <span className="sl-sa-alerts-kpi-icon"><Bell aria-hidden="true" /></span>
          <div>
            <span>Overstock Alerts</span>
            <strong>—</strong>
            <small>Awaiting overstock alerts API</small>
          </div>
        </article>

        <article className="sl-sa-alerts-kpi" data-tone="success">
          <span className="sl-sa-alerts-kpi-icon"><TrendingUp aria-hidden="true" /></span>
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
