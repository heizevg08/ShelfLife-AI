import { ChevronDown, Download, Filter, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAuditRecords, type AuditFilters, type AuditRecord, type Page } from '../../services/administration';
import { administrationFilterCatalog } from './administration';
import { reportExportFormats } from './module-content';
import { DataState, Pagination, SummaryCards } from './primitives';

const AUTO_REFRESH_MS = 15000;
const auditActionByLabel: Record<string, AuditFilters['action']> = {
  'Account created': 'CREATE',
  'Account updated': 'UPDATE',
  'Account deactivated': 'DEACTIVATE',
  'Account reactivated': 'REACTIVATE',
};

export function AuditTable({ recent = false, adminOverview = false }: { recent?: boolean; adminOverview?: boolean }) {
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
  const [filtersCommitted, setFiltersCommitted] = useState(false);
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
    const matchesSearch = !normalizedSearch || [row.actor.name, row.actor.role, row.action, row.targetType, row.targetId].some(value => value.toLowerCase().includes(normalizedSearch));
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
    setFiltersCommitted(false);
    setRefresh(value => value + 1);
  };

  const applyAdminFilters = () => {
    setPage(1);
    setFiltersCommitted(true);
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

  return <>
    {adminOverview && <div className="sl-audit-overview" aria-label="Audit log overview and filters">
      <SummaryCards items={[
        { label: 'Total Logs', value: data?.total?.toLocaleString() ?? '—', detail: data ? 'Live audit records' : 'Awaiting audit data', tone: 'brand', trend: 'line' },
        { label: 'Unique Users', value: data ? uniqueUsers.toLocaleString() : '—', detail: data ? `Across ${rows.length} loaded records` : 'Awaiting audit data', tone: 'success', trend: 'accuracy' },
        { label: 'Most Common Action', value: commonAction?.[0] ?? '—', detail: commonAction ? `${commonAction[1]} loaded records` : 'Preview · data pending', tone: 'attention', trend: 'bars' },
        { label: 'Critical Activities', value: '—', detail: 'Preview · data pending', tone: 'critical', trend: 'segments' },
      ]} />
      <div className="sl-audit-filter-strip">
        <label>Date Range<select className="sl-admin-input" value={periodFilter} onChange={event => { setPage(1); setPeriodFilter(event.target.value); setFiltersCommitted(false); }}>{administrationFilterCatalog.audit.period.map(period => <option key={period}>{period}</option>)}</select></label>
        {periodFilter === 'Custom' && <div className="sl-audit-specific-dates" aria-label="Custom date range"><label>From<input className="sl-admin-input" type="date" value={specificFrom} max={specificTo || undefined} onChange={event => { setSpecificFrom(event.target.value); setFiltersCommitted(false); }} /></label><label>To<input className="sl-admin-input" type="date" value={specificTo} min={specificFrom || undefined} onChange={event => { setSpecificTo(event.target.value); setFiltersCommitted(false); }} /></label></div>}
        <label>User<select className="sl-admin-input" value={actorFilter || actorOptions[0]} onChange={event => { setPage(1); setActorFilter(event.target.value === actorOptions[0] ? '' : event.target.value); setFiltersCommitted(false); }}>{actorOptions.map(actor => <option key={actor}>{actor}</option>)}</select></label>
        <label>Action<select className="sl-admin-input" value={actionFilter || actionOptions[0]} onChange={event => { setPage(1); setActionFilter(event.target.value === actionOptions[0] ? '' : event.target.value); setFiltersCommitted(false); }}>{actionOptions.map(action => <option key={action}>{action}</option>)}</select></label>
        <label>Module<select className="sl-admin-input" value={moduleFilter || moduleOptions[0]} onChange={event => { setPage(1); setModuleFilter(event.target.value === moduleOptions[0] ? '' : event.target.value); setFiltersCommitted(false); }}>{moduleOptions.map(module => <option key={module}>{module}</option>)}</select></label>
        <label>Status<select className="sl-admin-input" value={statusFilter || administrationFilterCatalog.audit.status[0]} onChange={event => { setStatusFilter(event.target.value === administrationFilterCatalog.audit.status[0] ? '' : event.target.value); setFiltersCommitted(false); }}>{administrationFilterCatalog.audit.status.map(status => <option key={status}>{status}</option>)}</select></label>
        <button type="button" className={`sl-button sl-audit-apply ${filtersCommitted ? 'sl-button-secondary' : 'sl-button-primary'}`} onClick={filtersCommitted ? resetAdminFilters : applyAdminFilters}>{filtersCommitted ? 'Reset Filters' : 'Apply Filters'}</button>
      </div>
    </div>}
    <div className={adminOverview ? "sl-audit-results-layout" : undefined}>
    <section className={recent ? "sl-audit-fragment" : adminOverview ? "sl-card sl-admin-audit-table-card" : "sl-card"} aria-labelledby={recent ? undefined : "sl-system-audit-log"}>
      {!recent && <div className="sl-card-header sl-audit-table-heading"><h2 className="sl-section-title" id="sl-system-audit-log">System Audit Logs</h2>{adminOverview && <div className="sl-audit-table-controls"><label className="sl-directory-search sl-audit-search"><Search size={17} aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search logs..." aria-label="Search audit logs" /></label><div className="sl-download-control"><button type="button" className="sl-button sl-download-trigger" aria-expanded={downloadOpen} aria-controls="sl-audit-download-menu" onClick={() => setDownloadOpen(value => !value)}><Download size={17} aria-hidden="true" />Export Logs<ChevronDown size={16} aria-hidden="true" /></button>{downloadOpen && <div id="sl-audit-download-menu" className="sl-download-menu" role="menu" aria-label="Audit export formats">{reportExportFormats.map(format => <button key={format.id} type="button" role="menuitem" disabled className="sl-download-option"><span>{format.label}</span></button>)}<p className="sl-supporting">Exports activate when the audit export service and permissions are available.</p></div>}</div></div>}</div>}
      <div className={recent ? "sl-audit-fragment-body" : "sl-card-body"}>
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

    <div className="sl-table-scroll" role="region" aria-label="Administrative audit records" tabIndex={0}>
        <table className="sl-data-table">
          <thead><tr><th scope="col">Date &amp; Time</th><th scope="col">User</th><th scope="col">Action</th>{adminOverview && <th scope="col">Module</th>}<th scope="col">Details</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {error ? <tr><td colSpan={adminOverview ? 6 : 5} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(x => x + 1)}>Retry</button>} /></td></tr>
            : !data ? <tr><td colSpan={adminOverview ? 6 : 5} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="" /></td></tr>
            : !visibleRows.length ? <tr><td colSpan={adminOverview ? 6 : 5} className="sl-empty-cell"><DataState kind="empty" title={filtersApplied ? 'No records match these filters' : 'No administrative activity yet'} description={filtersApplied ? 'Change or clear the current filters.' : "You're all caught up — successful account changes will show up here automatically."} /></td></tr>
            : visibleRows.map(row => <tr key={row.id}>
              <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
              <td className="sl-record-id">{row.actor.name} · {row.actor.role}</td>
              <td>{row.action}</td>
              {adminOverview && <td>{row.targetType}</td>}
              <td><span>{row.targetType}</span><div className="sl-record-id">{row.targetId}</div></td>
              <td><span className="sl-status" data-tone="success">Success</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>

    {!recent && data && <>
      {adminOverview ? <div className="sl-audit-table-footer"><label className="sl-audit-page-size sl-audit-page-size-footer">Rows per page<select className="sl-admin-input" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div> : <div className="sl-audit-export-row"><div className="sl-download-control"><button type="button" className="sl-button sl-download-trigger" aria-expanded={downloadOpen} aria-controls="sl-audit-download-menu" onClick={() => setDownloadOpen(value => !value)}><Download size={17} aria-hidden="true" />Export<ChevronDown size={16} aria-hidden="true" /></button>{downloadOpen && <div id="sl-audit-download-menu" className="sl-download-menu" role="menu" aria-label="Audit export formats">{reportExportFormats.map(format => <button key={format.id} type="button" role="menuitem" disabled className="sl-download-option"><span>{format.label}</span></button>)}<p className="sl-supporting">Exports activate when the audit export service and permissions are available.</p></div>}</div></div>}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} itemLabel={adminOverview ? "logs" : "records"} onPageChange={setPage} compact={adminOverview} />
    </>}
      </div>
    </section>
    </div>
  </>;
}
