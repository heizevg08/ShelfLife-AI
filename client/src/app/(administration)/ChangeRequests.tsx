import { useState } from 'react';
import { CheckCircle2, Clock3, FileInput, Plus, Search, XCircle } from 'lucide-react';
import { APPLICATION_RECORD_PAGE_SIZES, ApplicationPendingState } from '../../components/application/ApplicationPatterns';
import { PageHeader, Pagination } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage } from '../../components/application/ModulePage';

const DATE_RANGES = ['All dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom range'] as const;
const REQUEST_COLUMNS = ['Request ID', 'Date Submitted', 'Ingredient', 'Request Type', 'Details / Reason', 'Status', 'Reviewed By'] as const;

function InventoryStaffChangeRequests() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All Types');
  const [status, setStatus] = useState('All Statuses');
  const [range, setRange] = useState<(typeof DATE_RANGES)[number]>('All dates');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState(10);
  const reset = () => { setSearch(''); setType('All Types'); setStatus('All Statuses'); setRange('All dates'); setDateFrom(''); setDateTo(''); };

  return <>
    <PageHeader eyebrow="Inventory operations" title="My Requests" description="Track the status of your inventory change requests." />
    <div className="sl-admin-view sl-staff-my-requests">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-my-requests-kpis" aria-label="My request summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileInput /></span><div><span>Total Requests</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><CheckCircle2 /></span><div><span>Approved</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Pending Review</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><XCircle /></span><div><span>Rejected</span><strong>—</strong><small>Data unavailable</small></div></article>
      </section>
      <section className="sl-application-records sl-staff-my-requests-records" aria-labelledby="my-request-records-title">
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileInput aria-hidden="true" /></span><h2 id="my-request-records-title">Change Request Records</h2></header>
        <div className="sl-application-records-filters"><div className="sl-staff-my-requests-toolbar">
          <label className="sl-application-records-search"><span>Search records</span><div><Search size={17} aria-hidden="true" /><input type="search" value={search} disabled placeholder="Search by request ID, ingredient, or Batch ID..." aria-label="Search requests" onChange={event => setSearch(event.target.value)} /></div></label>
          <label><span>Type</span><select value={type} disabled onChange={event => setType(event.target.value)}><option>All Types</option></select></label>
          <label><span>Status</span><select value={status} disabled onChange={event => setStatus(event.target.value)}><option>All Statuses</option></select></label>
          <label><span>Date range</span><select value={range} disabled onChange={event => setRange(event.target.value as (typeof DATE_RANGES)[number])}>{DATE_RANGES.map(option => <option key={option}>{option}</option>)}</select></label>
          {range === 'Custom range' && <div className="sl-staff-my-requests-custom-range"><label><span>From</span><input type="date" disabled value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /></label><label><span>To</span><input type="date" disabled value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} /></label></div>}
          <div className="sl-application-records-filter-actions"><button type="button" className="sl-button" onClick={reset}>Reset</button><button type="button" className="sl-button sl-button-primary" disabled title="Change requests are not connected yet"><Plus size={16} aria-hidden="true" />New Request</button></div>
        </div></div>
        <div className="sl-application-records-table-shell sl-staff-my-requests-table-shell"><table className="sl-application-records-table sl-staff-my-requests-table" aria-label="My change requests"><thead><tr>{REQUEST_COLUMNS.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={REQUEST_COLUMNS.length} className="sl-empty-cell"><ApplicationPendingState description="Change requests will appear here once the service is connected." /></td></tr></tbody></table></div>
        <footer className="sl-application-records-footer"><label><span>Rows per page</span><select value={rows} disabled onChange={event => setRows(Number(event.target.value))}>{APPLICATION_RECORD_PAGE_SIZES.map(option => <option key={option}>{option}</option>)}</select></label><Pagination compact page={1} pageSize={rows} total={0} itemLabel="request records" onPageChange={() => {}} /></footer>
      </section>
    </div>
  </>;
}

export default function ChangeRequests() {
  const { user } = useApplicationWorkspace();
  if (user.role === 'Inventory Staff') return <InventoryStaffChangeRequests />;
  return <ModulePage moduleId="ChangeRequests" />;
}
