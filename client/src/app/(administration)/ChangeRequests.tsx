import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileInput, Filter, Search } from 'lucide-react';
import { Card, DataState, PageHeader, Status } from '../../components/application/primitives';

function PendingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-sa-change-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={label}
        action={<Status>Preview · data pending</Status>}
      />
    </div>
  );
}

export default function ChangeRequests() {
  return <>
    <PageHeader
      eyebrow="System Controls"
      title="Change Requests"
      description="Review and manage requests for changes to ingredients, inventory, and other master data."
    />

    <div className="sl-admin-view sl-sa-change-page">
      <section className="sl-sa-change-kpis" aria-label="Change request summary">
        <article className="sl-sa-change-kpi" data-tone="brand">
          <span className="sl-sa-change-kpi-icon"><FileInput aria-hidden="true" /></span>
          <div>
            <span>Total Requests</span>
            <strong>—</strong>
            <small>Awaiting request-summary API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="attention">
          <span className="sl-sa-change-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Pending Review</span>
            <strong>—</strong>
            <small>Awaiting review queue API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="success">
          <span className="sl-sa-change-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Approved</span>
            <strong>—</strong>
            <small>Awaiting approvals API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="critical">
          <span className="sl-sa-change-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Rejected</span>
            <strong>—</strong>
            <small>Awaiting decision API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-change-layout">
        <main className="sl-sa-change-main">
          <section className="sl-sa-change-filter-card" aria-label="Change request filters">
            <label className="sl-sa-change-search">
              <span>Search requests</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by request ID, ingredient, user, or details…"
                  disabled
                  aria-label="Change request search unavailable until request service is connected"
                />
              </div>
            </label>

            <label>
              <span>Request Type</span>
              <select disabled aria-label="Request type filter unavailable">
                <option>All Types</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select disabled aria-label="Status filter unavailable">
                <option>All Statuses</option>
              </select>
            </label>

            <label>
              <span>Requested By (Role)</span>
              <select disabled aria-label="Role filter unavailable">
                <option>All Roles</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-change-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-change-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-change-table-card" aria-label="Change requests">
            <div className="sl-sa-change-table-toolbar">
              <span>Change requests</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-change-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Change requests"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-change-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live change-request records are available.</span>
            </footer>
          </section>
        </main>

        <aside className="sl-sa-change-rail" aria-label="Change request analytics">
          <Card id="sa-change-type" title="Requests by Type">
            <PendingPanel label="Change request types" compact />
          </Card>

          <Card id="sa-change-status" title="Requests by Status">
            <PendingPanel label="Request statuses" compact />
          </Card>

          <Card id="sa-change-recent" title="Recent Activity">
            <PendingPanel label="Change request activity" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}
