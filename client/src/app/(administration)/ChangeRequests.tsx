import { CalendarDays, CheckCircle2, Clock3, FileInput, Search, XCircle } from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';

const Empty = ({label}:{label:string}) => <DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} />;

export default function ChangeRequests() {
  return <>
    <PageHeader title="Change Requests" description="Review and decide on inventory-related requests submitted by your team." />
    <div className="sl-admin-view sl-mgr-cr-page">
      <section className="sl-mgr-cr-kpis" aria-label="Change request summary">
        <article className="sl-mgr-cr-kpi tone-blue"><span className="sl-mgr-cr-icon"><FileInput/></span><div><small>Total Requests</small><strong>—</strong><span>Preview · data pending</span></div></article>
        <article className="sl-mgr-cr-kpi tone-amber"><span className="sl-mgr-cr-icon"><Clock3/></span><div><small>Pending Review</small><strong>—</strong><span>Requires your action</span></div></article>
        <article className="sl-mgr-cr-kpi tone-green"><span className="sl-mgr-cr-icon"><CheckCircle2/></span><div><small>Approved (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article>
        <article className="sl-mgr-cr-kpi tone-red"><span className="sl-mgr-cr-icon"><XCircle/></span><div><small>Rejected (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article>
      </section>

      <div className="sl-mgr-cr-layout">
        <section className="sl-mgr-cr-listcard">
          <nav className="sl-mgr-cr-tabs" aria-label="Request status">
            <button className="active">All Requests <span>—</span></button><button>Pending <span>—</span></button><button>Approved <span>—</span></button><button>Rejected <span>—</span></button>
          </nav>
          <div className="sl-mgr-cr-filters">
            <label className="search"><span className="sr-only">Search requests</span><div><Search size={17}/><input placeholder="Search requests..." disabled /></div></label>
            <label><span>Request Type</span><select disabled><option>All Types</option></select></label>
            <label><span>Submitted By</span><select disabled><option>All Staff</option></select></label>
            <label><span>Date Range</span><div className="date"><CalendarDays size={16}/><select disabled><option>Last 30 Days</option></select></div></label>
            <button className="sl-button" disabled>Reset</button>
          </div>
          <div className="sl-mgr-cr-tablewrap">
            <table className="sl-mgr-cr-table"><thead><tr><th></th><th>#</th><th>Request ID</th><th>Type</th><th>Ingredient / Batch</th><th>Requested Change</th><th>Submitted By</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead></table>
            <div className="sl-mgr-cr-empty"><Empty label="Change requests" /></div>
          </div>
          <footer className="sl-mgr-cr-footer"><label>Rows per page <select disabled><option>10</option></select></label><span>Pagination will appear when live request records are available.</span></footer>
        </section>

        <aside className="sl-mgr-cr-details">
          <header><strong>Request Details</strong><button aria-label="Close request details" disabled>×</button></header>
          <div className="sl-mgr-cr-detail-empty"><Empty label="Select a request to review its details" /></div>
          <footer><button className="reject" disabled>Reject</button><button className="approve" disabled>Approve</button></footer>
        </aside>
      </div>
    </div>
  </>;
}
