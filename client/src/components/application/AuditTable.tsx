import { ChevronDown, Clock3, Download, FileText, Filter, ListChecks, Search, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAuditRecords, type AuditFilters, type AuditRecord, type Page } from '../../services/administration';
import { administrationFilterCatalog } from './administration';
import { APPLICATION_RECORD_PAGE_SIZES, ApplicationPendingState } from './ApplicationPatterns';
import { reportExportFormats } from './module-content';
import { DataState, ExportControl, Pagination, Status } from './primitives';

const AUTO_REFRESH_MS = 15000;
const auditActionByLabel: Record<string, AuditFilters['action']> = {
  'Account created': 'CREATE',
  'Account updated': 'UPDATE',
  'Account deactivated': 'DEACTIVATE',
  'Account reactivated': 'REACTIVATE',
};

export function AuditTable({ recent = false, adminOverview = false, adminDashboard = false }: { recent?: boolean; adminOverview?: boolean; adminDashboard?: boolean }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>(administrationFilterCatalog.audit.period[0]);
  const [data, setData] = useState<Page<AuditRecord> | null>(null);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [specificFrom, setSpecificFrom] = useState('');
  const [specificTo, setSpecificTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    if (!data) setError(false);
    const cutoffDays = periodFilter === 'Last week' ? 7 : periodFilter === 'Last month' ? 30 : periodFilter === 'Last year' ? 365 : 0;
    const specificStart = periodFilter === 'Custom' && specificFrom ? new Date(`${specificFrom}T00:00:00`).toISOString() : undefined;
    const specificEnd = periodFilter === 'Custom' && specificTo ? new Date(`${specificTo}T23:59:59.999`).toISOString() : undefined;
    const filters: AuditFilters = recent ? {} : {
      actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
      action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
      from: specificStart ?? (cutoffDays ? new Date(Date.now() - cutoffDays * 86400000).toISOString() : undefined),
      to: specificEnd,
    };
    listAuditRecords(page, recent ? 5 : pageSize, 'desc', filters, abort.signal)
      .then(value => { if (!abort.signal.aborted) { setData(value); setLastUpdatedAt(new Date()); } })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [page, pageSize, refresh, recent, actorFilter, actionFilter, periodFilter, specificFrom, specificTo]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const actorOptions = [...administrationFilterCatalog.audit.actor];
  const actionOptions = [...administrationFilterCatalog.audit.action];
  const rows = data?.items ?? [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const rowStatus = (_row: AuditRecord) => 'Success';
  const moduleOptions = ['All modules', ...Array.from(new Set(rows.map(row => row.targetType).filter(Boolean))).sort()];
  const visibleRows = rows.filter(row => {
    const matchesSearch = !normalizedSearch || [row.actor.name, row.actor.role, row.action, row.targetType, row.targetName ?? ''].some(value => value.toLowerCase().includes(normalizedSearch));
    const matchesStatus = !statusFilter || rowStatus(row) === statusFilter;
    const matchesModule = !moduleFilter || row.targetType === moduleFilter;
    return matchesSearch && matchesStatus && matchesModule;
  });
  const filtersApplied = !!actorFilter || !!actionFilter || !!moduleFilter || !!statusFilter || periodFilter !== administrationFilterCatalog.audit.period[0] || !!normalizedSearch;

  const resetAdminFilters = () => {
    setActorFilter('');
    setActionFilter('');
    setPeriodFilter(administrationFilterCatalog.audit.period[0]);
    setPage(1);
    setStatusFilter('');
    setModuleFilter('');
    setSpecificFrom('');
    setSpecificTo('');
    setSearchTerm('');
    setRefresh(value => value + 1);
  };

  const lastUpdatedLabel = lastUpdatedAt
    ? `Last updated: ${lastUpdatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`
    : 'Last updated: waiting for data';

  const uniqueUsers = new Set(rows.map(row => row.actor.id)).size;
  const actionCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.action] = (counts[row.action] ?? 0) + 1;
    return counts;
  }, {});
  const commonAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];
  const actionLabel = (action: string) => ({ CREATE: 'Created', UPDATE: 'Updated', DEACTIVATE: 'Deactivated', REACTIVATE: 'Reactivated' }[action] ?? action);
  const auditDetails = (row: AuditRecord) => `${actionLabel(row.action)} ${row.targetType.toLowerCase()}${row.targetName ? ` ${row.targetName}` : ''}`;

  return <>
    {adminOverview && <div className="sl-audit-overview" aria-label="Audit log overview">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Audit log summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span><div><span>Total Logs</span><strong>{data?.total?.toLocaleString() ?? '—'}</strong><small>{data ? 'Live audit records' : 'Awaiting audit data'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span><div><span>Unique Users</span><strong>{data ? uniqueUsers.toLocaleString() : '—'}</strong><small>{data ? `Across ${rows.length} loaded records` : 'Awaiting audit data'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><ListChecks aria-hidden="true" /></span><div><span>Most Common Action</span><strong>{commonAction?.[0] ?? '—'}</strong><small>{commonAction ? `${commonAction[1]} loaded records` : 'Audit summary unavailable'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Recent Administrative Changes</span><strong>{data ? rows.length.toLocaleString() : '—'}</strong><small>{data ? 'Loaded audit records' : 'Awaiting audit data'}</small></div></article>
      </section>
    </div>}
    <div className={adminOverview ? "sl-audit-results-layout" : undefined}>
    <section className={recent ? "sl-audit-fragment" : adminOverview ? "sl-application-records sl-application-records-overflow sl-admin-audit-records" : "sl-card"} aria-labelledby={recent ? undefined : "sl-system-audit-log"}>
      {!recent && (adminOverview ? <>
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileText aria-hidden="true" /></span><h2 id="sl-system-audit-log">Audit Logs</h2></header>
      </> : <div className="sl-card-header sl-audit-table-heading"><h2 className="sl-section-title" id="sl-system-audit-log">System Audit Logs</h2></div>)}
      <div className={recent ? "sl-audit-fragment-body" : adminOverview ? "sl-application-records-body" : "sl-card-body"}>
    {adminOverview && <div className="sl-audit-filter-strip">
      <label className="sl-application-records-compact-search"><span>Search</span><span><Search size={17} aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search logs..." aria-label="Search audit logs" /></span></label>
      <label>Date Range<select className="sl-admin-input" value={periodFilter} onChange={event => { setPage(1); setPeriodFilter(event.target.value); }}>{administrationFilterCatalog.audit.period.map(period => <option key={period}>{period}</option>)}</select></label>
      {periodFilter === 'Custom' && <div className="sl-audit-specific-dates" aria-label="Custom date range"><label>From<input className="sl-admin-input" type="date" value={specificFrom} max={specificTo || undefined} onChange={event => setSpecificFrom(event.target.value)} /></label><label>To<input className="sl-admin-input" type="date" value={specificTo} min={specificFrom || undefined} onChange={event => setSpecificTo(event.target.value)} /></label></div>}
      <label>User<select className="sl-admin-input" value={actorFilter || actorOptions[0]} onChange={event => { setPage(1); setActorFilter(event.target.value === actorOptions[0] ? '' : event.target.value); }}>{actorOptions.map(actor => <option key={actor}>{actor}</option>)}</select></label>
      <label>Action<select className="sl-admin-input" value={actionFilter || actionOptions[0]} onChange={event => { setPage(1); setActionFilter(event.target.value === actionOptions[0] ? '' : event.target.value); }}>{actionOptions.map(action => <option key={action}>{action}</option>)}</select></label>
      <label>Module<select className="sl-admin-input" value={moduleFilter || moduleOptions[0]} onChange={event => { setPage(1); setModuleFilter(event.target.value === moduleOptions[0] ? '' : event.target.value); }}>{moduleOptions.map(module => <option key={module}>{module}</option>)}</select></label>
      <label>Status<select className="sl-admin-input" value={statusFilter || administrationFilterCatalog.audit.status[0]} onChange={event => { setPage(1); setStatusFilter(event.target.value === administrationFilterCatalog.audit.status[0] ? '' : event.target.value); }}>{administrationFilterCatalog.audit.status.map(status => <option key={status}>{status}</option>)}</select></label>
      <button type="button" className="sl-button" onClick={resetAdminFilters}>Reset</button>
      <ExportControl label="Export" menuId="sl-admin-audit-export-menu" />
    </div>}
    {!recent && !adminOverview && <div className="sl-table-toolbar sl-audit-toolbar">
      <div className="sl-audit-toolbar-right">
        <span className="sl-supporting sl-auto-update-note" aria-live="polite">{lastUpdatedLabel}</span>
        <div className="sl-filter-control">
          <button
            type="button"
            className="sl-icon-button sl-filter-trigger"
            aria-label="Open audit filters"
            aria-expanded={filtersOpen}
            aria-controls="sl-audit-filter-panel"
            onClick={() => setFiltersOpen(value => !value)}
          >
            <Filter size={18} aria-hidden="true" />
          </button>
          {filtersOpen && <div id="sl-audit-filter-panel" className="sl-filter-popover" role="dialog" aria-label="Audit filters">
            <div className="sl-filter-popover-header">
              <strong>Filters</strong>
              <button type="button" className="sl-icon-button sl-close-button" aria-label="Close audit filters" onClick={() => setFiltersOpen(false)}><X size={17} aria-hidden="true" /></button>
            </div>
            <div className="sl-filter-popover-body sl-dynamic-filter-groups">
              <label>User
                <select className="sl-admin-input" value={actorFilter || actorOptions[0]} onChange={event => { setPage(1); setActorFilter(event.target.value === actorOptions[0] ? '' : event.target.value); }}>
                  {actorOptions.map(actor => <option key={actor}>{actor}</option>)}
                </select>
              </label>
              <label>Action
                <select className="sl-admin-input" value={actionFilter || actionOptions[0]} onChange={event => { setPage(1); setActionFilter(event.target.value === actionOptions[0] ? '' : event.target.value); }}>
                  {actionOptions.map(action => <option key={action}>{action}</option>)}
                </select>
              </label>
              <label>Date range
                <select className="sl-admin-input" value={periodFilter} onChange={event => { setPage(1); setPeriodFilter(event.target.value); }}>
                  {administrationFilterCatalog.audit.period.map(period => <option key={period}>{period}</option>)}
                </select>
              </label>
              <button type="button" className="sl-button sl-filter-clear" onClick={() => { setActorFilter(''); setActionFilter(''); setPeriodFilter(administrationFilterCatalog.audit.period[0]); setPage(1); }}>Clear filters</button>
            </div>
          </div>}
        </div>
      </div>
    </div>}

    <div className={adminOverview ? "sl-application-records-table-shell" : "sl-table-scroll"} role="region" aria-label="Administrative audit records" tabIndex={0}>
        <table className={adminOverview ? "sl-application-records-table" : "sl-data-table"} data-layout={adminOverview ? 'audit' : adminDashboard ? 'admin-dashboard-audit' : undefined}>
          <thead><tr>{adminDashboard ? <><th scope="col">User</th><th scope="col">Action</th><th scope="col">Date &amp; Time</th><th scope="col">Status</th></> : <>{adminOverview && <th scope="col">#</th>}<th scope="col">Date &amp; Time</th><th scope="col">User</th><th scope="col">Action</th>{adminOverview && <th scope="col">Module</th>}<th scope="col">Details</th><th scope="col">Status</th></>}</tr></thead>
          <tbody>
            {adminOverview && error ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
            : adminOverview && !data ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="Retrieving live audit records." /></td></tr>
            : adminOverview && !visibleRows.length ? <tr><td colSpan={7} className="sl-empty-cell"><ApplicationPendingState className="sl-application-records-state" description={filtersApplied ? 'No audit records match the selected filters.' : 'Administrative activity will appear here when audit records are available.'} /></td></tr>
            : recent && (error || !data || !visibleRows.length) ? adminDashboard
              ? <tr><td colSpan={4} className="sl-empty-cell"><ApplicationPendingState description={error ? 'Recent user activity could not be loaded.' : !data ? 'Recent user activity is loading.' : 'Recent user activity will appear when audit records are available.'} /></td></tr>
              : <tr className="sl-dashboard-audit-fallback-row" aria-label={error ? 'Recent activity could not be loaded' : !data ? 'Recent activity loading' : 'No recent activity available'}>{Array.from({ length: 5 }, (_, index) => <td key={index}>—</td>)}</tr>
            : error ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(x => x + 1)}>Retry</button>} /></td></tr>
            : !data ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="" /></td></tr>
            : !visibleRows.length ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="empty" title={filtersApplied ? 'No records match these filters' : 'No administrative activity yet'} description={filtersApplied ? 'Change or clear the current filters.' : "You're all caught up — successful account changes will show up here automatically."} /></td></tr>
            : visibleRows.map(row => adminDashboard ? <tr key={row.id}>
              <td className="sl-record-id">{row.actor.name || '—'}</td>
              <td className="sl-emphasized-value">{row.action}</td>
              <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
              <td><span className="sl-status" data-tone="success">Success</span></td>
            </tr> : <tr key={row.id}>
                <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
                {adminOverview && <td>{(data.page - 1) * data.pageSize + visibleRows.indexOf(row) + 1}</td>}
                <td className="sl-record-id">{adminOverview ? row.actor.name || '—' : `${row.actor.name} · ${row.actor.role}`}</td>
                <td className={adminOverview ? 'sl-emphasized-value' : undefined}>{row.action}</td>
                {adminOverview && <td>{row.targetType}</td>}
                <td>{adminOverview ? auditDetails(row) : <><span>{row.targetType}</span><div className="sl-record-id">{row.targetId}</div></>}</td>
                <td><span className="sl-status" data-tone="success">Success</span></td>
              </tr>)}
          </tbody>
        </table>
      </div>

    {!recent && <>
      {adminOverview ? <div className="sl-application-records-footer"><label className="sl-audit-page-size-footer"><span>Rows per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label><Pagination page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="audit records" onPageChange={setPage} compact /></div> : <><div className="sl-audit-export-row"><div className="sl-download-control"><button type="button" className="sl-button sl-download-trigger" aria-expanded={downloadOpen} aria-controls="sl-audit-download-menu" onClick={() => setDownloadOpen(value => !value)}><Download size={17} aria-hidden="true" />Export<ChevronDown size={16} aria-hidden="true" /></button>{downloadOpen && <div id="sl-audit-download-menu" className="sl-download-menu" role="menu" aria-label="Audit export formats">{reportExportFormats.map(format => <button key={format.id} type="button" role="menuitem" disabled className="sl-download-option"><span>{format.label}</span></button>)}<p className="sl-supporting">Exports activate when the audit export service and permissions are available.</p></div>}</div></div><Pagination page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="records" onPageChange={setPage} /></>}
    </>}
      </div>
    </section>
    </div>
  </>;
}
