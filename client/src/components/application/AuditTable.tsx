import { Clock3, FileText, Filter, ListChecks, RefreshCw, Search, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadAuditXlsx, listAuditRecords, streamAuditRecorded, type AuditFilters, type AuditRecord, type Page } from '../../services/administration';
import { administrationFilterCatalog } from './administration';
import { APPLICATION_RECORD_PAGE_SIZES, ApplicationPendingState } from './ApplicationPatterns';
import { DataState, ExportControl, Pagination, Status } from './primitives';
import { DateRangeFilter, MANAGER_DATE_RANGE_OPTIONS, type DateRangeValue } from './DateRangeFilter';
import { publishActionFeedback } from '../../services/actionFeedback';
import { formatDateTime, formatTime } from '../../utils/date-time';
import { FilterSelect } from './FilterSelect';

const AUTO_REFRESH_MS = 15000;
const auditActionByLabel: Record<string, AuditFilters['action']> = {
  'Account created': 'CREATE',
  'Account updated': 'UPDATE',
  'Account deactivated': 'DEACTIVATE',
  'Account reactivated': 'REACTIVATE',
  'Data exported': 'EXPORT',
};

// constrainActorCell is opt-in: the Super Admin Security & Activity view asks for a
// single-line, ellipsised USER cell because its immutable audit identities can carry
// historical names that predate the current 1-25 character rule. Callers that do not
// pass it (Admin Audit Logs, the dashboards) keep their existing cell markup exactly.
export function AuditTable({ recent = false, adminOverview = false, adminDashboard = false, includeSuperAdminActors = false, showSummary = true, dashboardDetails = false, constrainActorCell = false }: { recent?: boolean; adminOverview?: boolean; adminDashboard?: boolean; includeSuperAdminActors?: boolean; showSummary?: boolean; dashboardDetails?: boolean; constrainActorCell?: boolean }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<DateRangeValue>('month');
  const [data, setData] = useState<Page<AuditRecord> | null>(null);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [specificFrom, setSpecificFrom] = useState('');
  const [specificTo, setSpecificTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    if (!data) setError(false);
    setSyncing(true);
    const cutoffDays = periodFilter === 'week' ? 7 : periodFilter === 'month' ? 30 : periodFilter === 'quarter' ? 90 : 0;
    const specificStart = periodFilter === 'custom' && specificFrom ? new Date(`${specificFrom}T00:00:00`).toISOString() : undefined;
    const specificEnd = periodFilter === 'custom' && specificTo ? new Date(`${specificTo}T23:59:59.999`).toISOString() : undefined;
    const filters: AuditFilters = recent ? {} : {
      actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
      action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
      status: statusFilter ? statusFilter as AuditFilters['status'] : undefined,
      search: searchTerm.trim() || undefined,
      from: specificStart ?? (cutoffDays ? new Date(Date.now() - cutoffDays * 86400000).toISOString() : undefined),
      to: specificEnd,
    };
    listAuditRecords(page, recent ? 5 : pageSize, 'desc', filters, abort.signal)
      .then(value => { if (!abort.signal.aborted) { setData(value); setError(false); setLastUpdatedAt(new Date()); } })
      .catch(() => { if (!abort.signal.aborted) setError(true); })
      .finally(() => { if (!abort.signal.aborted) setSyncing(false); });
    return () => abort.abort();
  }, [page, pageSize, refresh, recent, actorFilter, actionFilter, periodFilter, specificFrom, specificTo, statusFilter, searchTerm]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Real-time wake-up on the Audit Logs workspace: the server pushes a ping
  // whenever any module writes an audit record, so the table re-queries
  // immediately instead of waiting for the next poll. Both paths bump the same
  // refresh counter, so the re-fetch reuses the current page and filters — the
  // user's pagination and selections are never reset. The 15-second poll above
  // stays as the fallback whenever this stream is down, and bursts of writes
  // are coalesced into one refetch by the debounce below.
  useEffect(() => {
    if (!adminOverview) return;
    let disposed = false;
    let retryDelay = 1000;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let currentAbort: AbortController | undefined;
    const ping = () => {
      if (pingTimer !== undefined) return;
      pingTimer = window.setTimeout(() => { pingTimer = undefined; setRefresh(value => value + 1); }, 750);
    };
    const connect = () => {
      const abort = new AbortController();
      currentAbort = abort;
      streamAuditRecorded(ping, abort.signal, () => { retryDelay = 1000; })
        .catch(() => undefined)
        .finally(() => {
          if (disposed || abort.signal.aborted) return;
          retryTimer = window.setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        });
    };
    connect();
    return () => {
      disposed = true;
      currentAbort?.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (pingTimer !== undefined) window.clearTimeout(pingTimer);
    };
  }, [adminOverview]);

  const actorOptions = adminOverview ? ['All users', ...(includeSuperAdminActors ? ['Super Admin'] : []), 'Admin', 'Manager', 'Inventory Staff'] : [...administrationFilterCatalog.audit.actor];
  const actionOptions = adminOverview ? ['All actions', 'Account created', 'Account updated', 'Account deactivated', 'Account reactivated', 'Data exported'] : [...administrationFilterCatalog.audit.action];
  const rows = data?.items ?? [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const rowStatus = (row: AuditRecord) => row.status ?? 'Success';
  const visibleRows = adminOverview ? rows : rows.filter(row => {
    const matchesSearch = !normalizedSearch || [row.timestamp, row.actor.name, row.actor.role, row.action, row.targetType, row.targetId ?? '', row.targetName ?? '', rowStatus(row)].some(value => String(value ?? '').toLowerCase().includes(normalizedSearch));
    const matchesStatus = !statusFilter || rowStatus(row) === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const filtersApplied = !!actorFilter || !!actionFilter || !!statusFilter || periodFilter !== 'month' || !!normalizedSearch;

  const resetAdminFilters = () => {
    setActorFilter('');
    setActionFilter('');
    setPeriodFilter('month');
    setPage(1);
    setStatusFilter('');
    setSpecificFrom('');
    setSpecificTo('');
    setSearchTerm('');
  };

  const exportFilters: AuditFilters = {
    actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
    action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
    status: statusFilter ? statusFilter as AuditFilters['status'] : undefined,
    search: searchTerm.trim() || undefined,
    from: periodFilter === 'custom' && specificFrom ? new Date(`${specificFrom}T00:00:00`).toISOString() : new Date(Date.now() - (periodFilter === 'week' ? 7 : periodFilter === 'month' ? 30 : 90) * 86400000).toISOString(),
    to: periodFilter === 'custom' && specificTo ? new Date(`${specificTo}T23:59:59.999`).toISOString() : undefined,
  };
  const exportAudit = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadAuditXlsx(exportFilters);
      publishActionFeedback({ kind: 'success', message: 'Audit records XLSX downloaded.' });
    } catch {
      publishActionFeedback({ kind: 'error', message: 'The workbook could not be prepared. Try again later.' });
    } finally { setExporting(false); }
  };

  const lastUpdatedLabel = error && data
    ? `Auto-refresh failed — showing earlier records${lastUpdatedAt ? ` · last updated ${formatTime(lastUpdatedAt)}` : ''}`
    : lastUpdatedAt
      ? `Last updated: ${formatTime(lastUpdatedAt)}`
      : 'Last updated: waiting for data';
  const syncNote = syncing
    ? <><RefreshCw size={13} className="sl-spin" aria-hidden="true" /> Syncing…</>
    : lastUpdatedLabel;

  const uniqueUsers = new Set(rows.map(row => row.actor.id)).size;
  const actionCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.action] = (counts[row.action] ?? 0) + 1;
    return counts;
  }, {});
  const commonAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];
  const actionLabel = (action: string) => ({ CREATE: 'Created', UPDATE: 'Updated', DEACTIVATE: 'Deactivated', REACTIVATE: 'Reactivated', LOGIN: 'Signed in', LOGOUT: 'Signed out' }[action] ?? action);
  const actorName = (row: AuditRecord) => {
    return row.actor.name.trim() || 'Unknown account';
  };
  // detailsDisplay comes from the server-side formatter the XLSX export also
  // uses, so both surfaces word the same record identically; auditDetails stays
  // only as a fallback for a cached response that predates the field.
  const auditDetails = (row: AuditRecord) => {
    const entity = row.targetType.trim().toLowerCase() || 'target';
    const targetName = row.targetName?.trim() ?? '';
    const nameParts = targetName.split(/\s+/).filter(Boolean);
    const meaningfulName = nameParts.length >= 2 && nameParts.every(part => /\p{L}/u.test(part)) && nameParts.some(part => part.replace(/[^\p{L}]/gu, '').length > 1);
    return meaningfulName ? `${actionLabel(row.action)} ${entity} ${targetName}` : `${actionLabel(row.action)} ${entity} record`;
  };
  const dashboardAuditDetails = (row: AuditRecord) =>
    (row.detailsDisplay ?? auditDetails(row)).replace(/\s+successfully(?=\.?$)/i, '');
  // The dashboard variant gains one extra column (Details) only when a caller opts in,
  // so Admin's dashboard row count stays at five and its empty-state colspan stays correct.
  const dashboardRowColumnCount = dashboardDetails ? 6 : 5;

  return <>
    {adminOverview && showSummary && <div className="sl-audit-overview" aria-label="Audit log overview">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Audit log summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span><div><span>Total Logs</span><strong>{data?.total?.toLocaleString() ?? '—'}</strong><small>{data ? 'Live audit records' : 'Awaiting audit data'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span><div><span>Unique Users</span><strong>{data ? uniqueUsers.toLocaleString() : '—'}</strong><small>{data ? `Across ${rows.length} loaded records` : 'Awaiting audit data'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><ListChecks aria-hidden="true" /></span><div><span>Most Common Action</span><strong>{commonAction?.[0] ?? '—'}</strong><small>{commonAction ? `${commonAction[1]} loaded records` : 'Audit summary unavailable'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Recent Administrative Changes</span><strong>{data ? rows.length.toLocaleString() : '—'}</strong><small>{data ? 'Loaded audit records' : 'Awaiting audit data'}</small></div></article>
      </section>
    </div>}
    <div className={adminOverview ? "sl-admin-audit-layout" : undefined}>
    <section className={recent ? "sl-audit-fragment" : adminOverview ? "sl-application-records sl-application-records-overflow sl-admin-audit-records" : "sl-card"} aria-labelledby={recent ? undefined : "sl-system-audit-log"}>
      {!recent && (adminOverview ? <>
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileText aria-hidden="true" /></span><h2 id="sl-system-audit-log">Audit Logs</h2><span className="sl-supporting sl-auto-update-note" aria-live="polite">{syncNote}</span></header>
      </> : <div className="sl-card-header sl-audit-table-heading"><h2 className="sl-section-title" id="sl-system-audit-log">System Audit Logs</h2></div>)}
      <div className={recent ? "sl-audit-fragment-body" : adminOverview ? "sl-application-records-body" : "sl-card-body"}>
    {adminOverview && <div className="sl-application-records-filters"><div className="sl-application-records-toolbar sl-audit-filter-strip" data-layout="audit" data-custom={periodFilter === 'custom'}>
      <label className="sl-application-records-search"><span>Search</span><div><Search size={17} aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search logs..." aria-label="Search audit logs" /></div></label>
      <label className="sl-admin-audit-date-field"><span>Date Range</span><FilterSelect ariaLabel="Filter audit records by date range" value={periodFilter} options={MANAGER_DATE_RANGE_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => { setPeriodFilter(value as DateRangeValue); setSpecificFrom(''); setSpecificTo(''); setPage(1); }} /></label>
      {periodFilter === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom audit date range"><label><span>From</span><input type="date" value={specificFrom} max={specificTo || undefined} onChange={event => { setSpecificFrom(event.target.value); setPage(1); }} /></label><label><span>To</span><input type="date" value={specificTo} min={specificFrom || undefined} onChange={event => { setSpecificTo(event.target.value); setPage(1); }} /></label></div>}
      <label><span>User</span><FilterSelect ariaLabel="Filter audit records by user" value={actorFilter || actorOptions[0]} options={actorOptions.map(actor => ({value: actor, label: actor}))} onChange={value => { setPage(1); setActorFilter(value === actorOptions[0] ? '' : value); }}/></label>
      <label><span>Status</span><FilterSelect ariaLabel="Filter audit records by status" value={statusFilter || administrationFilterCatalog.audit.status[0]} options={administrationFilterCatalog.audit.status.map(status => ({value: status, label: status}))} onChange={value => { setPage(1); setStatusFilter(value === administrationFilterCatalog.audit.status[0] ? '' : value); }}/></label>
      <div className="sl-application-records-filter-actions"><button type="button" className="sl-button" disabled={exporting} onClick={resetAdminFilters}>Reset</button><ExportControl available loading={exporting} onExport={exportAudit} /></div>
    </div></div>}
    {!recent && !adminOverview && <div className="sl-table-toolbar sl-audit-toolbar">
      <div className="sl-audit-toolbar-right">
        <span className="sl-supporting sl-auto-update-note" aria-live="polite">{syncNote}</span>
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
                <FilterSelect ariaLabel="Filter audit records by user" value={actorFilter || actorOptions[0]} options={actorOptions.map(actor => ({value: actor, label: actor}))} onChange={value => { setPage(1); setActorFilter(value === actorOptions[0] ? '' : value); }}/>
              </label>
              <label>Action
                <FilterSelect ariaLabel="Filter audit records by action" value={actionFilter || actionOptions[0]} options={actionOptions.map(action => ({value: action, label: action}))} onChange={value => { setPage(1); setActionFilter(value === actionOptions[0] ? '' : value); }}/>
              </label>
              <DateRangeFilter value={periodFilter} from={specificFrom} to={specificTo} onChange={setPeriodFilter} onFromChange={setSpecificFrom} onToChange={setSpecificTo} label="Date range" />
              <button type="button" className="sl-button sl-filter-clear" onClick={() => { setActorFilter(''); setActionFilter(''); setPeriodFilter('month'); setSpecificFrom(''); setSpecificTo(''); setPage(1); }}>Clear filters</button>
            </div>
          </div>}
        </div>
      </div>
    </div>}

    <div className={adminOverview ? "sl-application-records-table-shell" : "sl-table-scroll"} role="region" aria-label="Administrative audit records" tabIndex={0}>
        <table className={adminOverview ? "sl-application-records-table" : "sl-data-table"} data-layout={adminOverview ? 'audit' : adminDashboard ? 'admin-dashboard-audit' : undefined}>
          <thead><tr>{adminDashboard ? <><th scope="col">#</th><th scope="col">User</th><th scope="col">Action</th><th scope="col">Date &amp; Time</th>{dashboardDetails && <th scope="col">Details</th>}<th scope="col">Status</th></> : <>{adminOverview && <th scope="col">#</th>}<th scope="col">Date &amp; Time</th><th scope="col">User</th><th scope="col">Action</th>{adminOverview && <th scope="col">Module</th>}<th scope="col">Details</th><th scope="col">Status</th></>}</tr></thead>
          <tbody>
            {adminOverview && error && !data ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
            : adminOverview && !data ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="Retrieving live audit records." /></td></tr>
            : adminOverview && !visibleRows.length ? <tr><td colSpan={7} className="sl-empty-cell"><ApplicationPendingState className="sl-application-records-state" description={filtersApplied ? 'No audit records match the selected filters.' : 'Administrative activity will appear here when audit records are available.'} /></td></tr>
            : recent && (!data || !visibleRows.length) ? adminDashboard
              ? <tr><td colSpan={dashboardRowColumnCount} className="sl-empty-cell"><ApplicationPendingState description={error ? 'Recent user activity could not be loaded.' : !data ? 'Recent user activity is loading.' : 'Recent user activity will appear when audit records are available.'} /></td></tr>
              : <tr className="sl-dashboard-audit-fallback-row" aria-label={error ? 'Recent activity could not be loaded' : !data ? 'Recent activity loading' : 'No recent activity available'}>{Array.from({ length: 5 }, (_, index) => <td key={index}>—</td>)}</tr>
            : error && !data ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(x => x + 1)}>Retry</button>} /></td></tr>
            : !data ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="" /></td></tr>
            : !visibleRows.length ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="empty" title={filtersApplied ? 'No records match these filters' : 'No administrative activity yet'} description={filtersApplied ? 'Change or clear the current filters.' : "You're all caught up — successful account changes will show up here automatically."} /></td></tr>
            : visibleRows.map((row, rowIndex) => adminDashboard ? <tr key={row.id}>
              <td>{(data.page - 1) * data.pageSize + rowIndex + 1}</td>
              <td className="sl-record-id"><span className="sl-emphasized-value">{actorName(row)}</span></td>
              <td>{row.action}</td>
              <td><time dateTime={row.timestamp}>{formatDateTime(row.timestamp)}</time></td>
              {dashboardDetails && <td>{dashboardAuditDetails(row)}</td>}
              <td><span className="sl-status" data-tone="success">Success</span></td>
            </tr> : <tr key={row.id}>
                {adminOverview && <td>{(data.page - 1) * data.pageSize + rowIndex + 1}</td>}
                <td><time dateTime={row.timestamp}>{formatDateTime(row.timestamp)}</time></td>
                <td className="sl-record-id">{adminOverview ? <span className={constrainActorCell ? 'sl-emphasized-value sl-audit-actor-cell' : 'sl-emphasized-value'} title={constrainActorCell ? actorName(row) : undefined}>{actorName(row)}</span> : `${row.actor.name} · ${row.actor.role}`}</td>
                <td className={adminOverview ? 'sl-emphasized-value' : undefined}>{row.action}</td>
                {adminOverview && <td>{row.module ?? row.targetType}</td>}
                <td>{adminOverview ? row.detailsDisplay ?? auditDetails(row) : <><span>{row.targetType}</span><div className="sl-record-id">{row.targetId}</div></>}</td>
                <td><Status tone={rowStatus(row) === 'Success' ? 'success' : rowStatus(row) === 'Warning' ? 'attention' : 'critical'}>{rowStatus(row)}</Status></td>
              </tr>)}
          </tbody>
        </table>
      </div>

    {!recent && <>
      {adminOverview ? <div className="sl-application-records-footer"><label className="sl-audit-page-size-footer"><span>Rows per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label><Pagination page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="audit records" onPageChange={setPage} compact /></div> : <><div className="sl-audit-export-row"><ExportControl unavailableMessage="XLSX export is available from the full Audit Logs workspace." /></div><Pagination page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="records" onPageChange={setPage} /></>}
    </>}
      </div>
    </section>
    </div>
  </>;
}
