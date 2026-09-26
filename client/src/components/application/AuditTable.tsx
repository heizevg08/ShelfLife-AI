import { ChevronDown, Clock3, Download, FileText, Filter, ListChecks, Search, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadAuditCsv, listAuditRecords, type AuditFilters, type AuditRecord, type Page } from '../../services/administration';
import { administrationFilterCatalog } from './administration';
import { APPLICATION_RECORD_PAGE_SIZES, ApplicationPendingState } from './ApplicationPatterns';
import { reportExportFormats } from './module-content';
import { DataState, ExportControl, Pagination, Status } from './primitives';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';
import { modules, workspaceNavigation, type WorkspaceRole } from './workspace';
import { publishActionFeedback } from '../../services/actionFeedback';

const AUTO_REFRESH_MS = 15000;
const auditActionByLabel: Record<string, AuditFilters['action']> = {
  'Account created': 'CREATE',
  'Account updated': 'UPDATE',
  'Account deactivated': 'DEACTIVATE',
  'Account reactivated': 'REACTIVATE',
  'Data exported': 'EXPORT',
};

export function AuditTable({ recent = false, adminOverview = false, adminDashboard = false }: { recent?: boolean; adminOverview?: boolean; adminDashboard?: boolean }) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<DateRangeValue>('any');
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
    const cutoffDays = periodFilter === 'week' ? 7 : periodFilter === 'month' ? 30 : periodFilter === 'year' ? 365 : 0;
    const specificStart = periodFilter === 'custom' && specificFrom ? new Date(`${specificFrom}T00:00:00`).toISOString() : undefined;
    const specificEnd = periodFilter === 'custom' && specificTo ? new Date(`${specificTo}T23:59:59.999`).toISOString() : undefined;
    const filters: AuditFilters = recent ? {} : {
      actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
      action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
      module: moduleFilter || undefined,
      status: statusFilter ? statusFilter as AuditFilters['status'] : undefined,
      search: searchTerm.trim() || undefined,
      from: specificStart ?? (cutoffDays ? new Date(Date.now() - cutoffDays * 86400000).toISOString() : undefined),
      to: specificEnd,
    };
    listAuditRecords(page, recent ? 5 : pageSize, 'desc', filters, abort.signal)
      .then(value => { if (!abort.signal.aborted) { setData(value); setLastUpdatedAt(new Date()); } })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [page, pageSize, refresh, recent, actorFilter, actionFilter, periodFilter, specificFrom, specificTo, statusFilter, moduleFilter, searchTerm]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const actorOptions = adminOverview ? ['All users', 'Admin', 'Manager', 'Inventory Staff'] : [...administrationFilterCatalog.audit.actor];
  const actionOptions = adminOverview ? ['All actions', 'Account created', 'Account updated', 'Account deactivated', 'Account reactivated', 'Data exported'] : [...administrationFilterCatalog.audit.action];
  const rows = data?.items ?? [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const rowStatus = (row: AuditRecord) => row.status ?? 'Success';
  const adminModuleOptions = [...new Set((['Admin', 'Manager', 'Inventory Staff'] as WorkspaceRole[]).flatMap(role => workspaceNavigation(role).map(item => {
    const moduleId = item.path.replace(/^\//, '') as keyof typeof modules;
    return modules[moduleId]?.label ?? item.label;
  })))].sort();
  const moduleOptions = adminOverview ? ['All modules', ...adminModuleOptions] : ['All modules', ...Array.from(new Set(rows.map(row => row.module ?? row.targetType).filter(Boolean))).sort()];
  const visibleRows = adminOverview ? rows : rows.filter(row => {
    const matchesSearch = !normalizedSearch || [row.timestamp, row.actor.name, row.actor.role, row.action, row.targetType, row.targetId ?? '', row.targetName ?? '', rowStatus(row)].some(value => String(value ?? '').toLowerCase().includes(normalizedSearch));
    const matchesStatus = !statusFilter || rowStatus(row) === statusFilter;
    const matchesModule = !moduleFilter || (row.module ?? row.targetType) === moduleFilter;
    return matchesSearch && matchesStatus && matchesModule;
  });
  const filtersApplied = !!actorFilter || !!actionFilter || !!moduleFilter || !!statusFilter || periodFilter !== 'any' || !!normalizedSearch;

  const resetAdminFilters = () => {
    setActorFilter('');
    setActionFilter('');
    setPeriodFilter('any');
    setPage(1);
    setStatusFilter('');
    setModuleFilter('');
    setSpecificFrom('');
    setSpecificTo('');
    setSearchTerm('');
  };

  const exportFilters: AuditFilters = {
    actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
    action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
    module: moduleFilter || undefined,
    status: statusFilter ? statusFilter as AuditFilters['status'] : undefined,
    search: searchTerm.trim() || undefined,
    from: periodFilter === 'custom' && specificFrom ? new Date(`${specificFrom}T00:00:00`).toISOString() : periodFilter === 'week' || periodFilter === 'month' || periodFilter === 'year' ? new Date(Date.now() - (periodFilter === 'week' ? 7 : periodFilter === 'month' ? 30 : 365) * 86400000).toISOString() : undefined,
    to: periodFilter === 'custom' && specificTo ? new Date(`${specificTo}T23:59:59.999`).toISOString() : undefined,
  };
  const exportAudit = async (format: (typeof reportExportFormats)[number]['id']) => {
    if (format !== 'csv') return;
    try {
      await downloadAuditCsv(exportFilters);
      publishActionFeedback({ kind: 'success', message: 'Audit records CSV downloaded.' });
    } catch {
      publishActionFeedback({ kind: 'error', message: 'Audit records could not be exported.' });
    }
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
  const actorName = (row: AuditRecord) => {
    return row.actor.name.trim() || 'Unknown account';
  };
  const auditDetails = (row: AuditRecord) => {
    const entity = row.targetType.trim().toLowerCase() || 'target';
    const targetName = row.targetName?.trim() ?? '';
    const nameParts = targetName.split(/\s+/).filter(Boolean);
    const meaningfulName = nameParts.length >= 2 && nameParts.every(part => /\p{L}/u.test(part)) && nameParts.some(part => part.replace(/[^\p{L}]/gu, '').length > 1);
    return meaningfulName ? `${actionLabel(row.action)} ${entity} ${targetName}` : `${actionLabel(row.action)} ${entity} record`;
  };

  return <>
    {adminOverview && <div className="sl-audit-overview" aria-label="Audit log overview">
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
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileText aria-hidden="true" /></span><h2 id="sl-system-audit-log">Audit Logs</h2></header>
      </> : <div className="sl-card-header sl-audit-table-heading"><h2 className="sl-section-title" id="sl-system-audit-log">System Audit Logs</h2></div>)}
      <div className={recent ? "sl-audit-fragment-body" : adminOverview ? "sl-application-records-body" : "sl-card-body"}>
    {adminOverview && <div className="sl-application-records-filters"><div className="sl-application-records-toolbar sl-audit-filter-strip" data-layout="audit">
      <label className="sl-application-records-search"><span>Search</span><div><Search size={17} aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search logs..." aria-label="Search audit logs" /></div></label>
      <DateRangeFilter className="sl-admin-audit-date-range" value={periodFilter} from={specificFrom} to={specificTo} onChange={value => { setPage(1); setPeriodFilter(value); }} onFromChange={value => { setPage(1); setSpecificFrom(value); }} onToChange={value => { setPage(1); setSpecificTo(value); }} />
      <label><span>User</span><select value={actorFilter || actorOptions[0]} onChange={event => { setPage(1); setActorFilter(event.target.value === actorOptions[0] ? '' : event.target.value); }}>{actorOptions.map(actor => <option key={actor}>{actor}</option>)}</select></label>
      <label><span>Action</span><select value={actionFilter || actionOptions[0]} onChange={event => { setPage(1); setActionFilter(event.target.value === actionOptions[0] ? '' : event.target.value); }}>{actionOptions.map(action => <option key={action}>{action}</option>)}</select></label>
      <label><span>Module</span><select value={moduleFilter || moduleOptions[0]} onChange={event => { setPage(1); setModuleFilter(event.target.value === moduleOptions[0] ? '' : event.target.value); }}>{moduleOptions.map(module => <option key={module}>{module}</option>)}</select></label>
      <label><span>Status</span><select value={statusFilter || administrationFilterCatalog.audit.status[0]} onChange={event => { setPage(1); setStatusFilter(event.target.value === administrationFilterCatalog.audit.status[0] ? '' : event.target.value); }}>{administrationFilterCatalog.audit.status.map(status => <option key={status}>{status}</option>)}</select></label>
      <div className="sl-application-records-filter-actions"><button type="button" className="sl-button" onClick={resetAdminFilters}>Reset</button><ExportControl label="Export" menuId="sl-admin-audit-export-menu" availableFormats={['csv']} onExport={exportAudit} /></div>
    </div></div>}
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
              <DateRangeFilter value={periodFilter} from={specificFrom} to={specificTo} onChange={setPeriodFilter} onFromChange={setSpecificFrom} onToChange={setSpecificTo} label="Date range" />
              <button type="button" className="sl-button sl-filter-clear" onClick={() => { setActorFilter(''); setActionFilter(''); setPeriodFilter('any'); setSpecificFrom(''); setSpecificTo(''); setPage(1); }}>Clear filters</button>
            </div>
          </div>}
        </div>
      </div>
    </div>}

    <div className={adminOverview ? "sl-application-records-table-shell" : "sl-table-scroll"} role="region" aria-label="Administrative audit records" tabIndex={0}>
        <table className={adminOverview ? "sl-application-records-table" : "sl-data-table"} data-layout={adminOverview ? 'audit' : adminDashboard ? 'admin-dashboard-audit' : undefined}>
          <thead><tr>{adminDashboard ? <><th scope="col">#</th><th scope="col">User</th><th scope="col">Action</th><th scope="col">Date &amp; Time</th><th scope="col">Status</th></> : <>{adminOverview && <th scope="col">#</th>}<th scope="col">Date &amp; Time</th><th scope="col">User</th><th scope="col">Action</th>{adminOverview && <th scope="col">Module</th>}<th scope="col">Details</th><th scope="col">Status</th></>}</tr></thead>
          <tbody>
            {adminOverview && error ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
            : adminOverview && !data ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="Retrieving live audit records." /></td></tr>
            : adminOverview && !visibleRows.length ? <tr><td colSpan={7} className="sl-empty-cell"><ApplicationPendingState className="sl-application-records-state" description={filtersApplied ? 'No audit records match the selected filters.' : 'Administrative activity will appear here when audit records are available.'} /></td></tr>
            : recent && (error || !data || !visibleRows.length) ? adminDashboard
              ? <tr><td colSpan={5} className="sl-empty-cell"><ApplicationPendingState description={error ? 'Recent user activity could not be loaded.' : !data ? 'Recent user activity is loading.' : 'Recent user activity will appear when audit records are available.'} /></td></tr>
              : <tr className="sl-dashboard-audit-fallback-row" aria-label={error ? 'Recent activity could not be loaded' : !data ? 'Recent activity loading' : 'No recent activity available'}>{Array.from({ length: 5 }, (_, index) => <td key={index}>—</td>)}</tr>
            : error ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(x => x + 1)}>Retry</button>} /></td></tr>
            : !data ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="loading" title="Loading activity" description="" /></td></tr>
            : !visibleRows.length ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="empty" title={filtersApplied ? 'No records match these filters' : 'No administrative activity yet'} description={filtersApplied ? 'Change or clear the current filters.' : "You're all caught up — successful account changes will show up here automatically."} /></td></tr>
            : visibleRows.map((row, rowIndex) => adminDashboard ? <tr key={row.id}>
              <td>{(data.page - 1) * data.pageSize + rowIndex + 1}</td>
              <td className="sl-record-id"><span className="sl-emphasized-value">{actorName(row)}</span></td>
              <td>{row.action}</td>
              <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
              <td><span className="sl-status" data-tone="success">Success</span></td>
            </tr> : <tr key={row.id}>
                {adminOverview && <td>{(data.page - 1) * data.pageSize + rowIndex + 1}</td>}
                <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
                <td className="sl-record-id">{adminOverview ? <span className="sl-emphasized-value">{actorName(row)}</span> : `${row.actor.name} · ${row.actor.role}`}</td>
                <td className={adminOverview ? 'sl-emphasized-value' : undefined}>{row.action}</td>
                {adminOverview && <td>{row.module ?? row.targetType}</td>}
                <td>{adminOverview ? auditDetails(row) : <><span>{row.targetType}</span><div className="sl-record-id">{row.targetId}</div></>}</td>
                <td><Status tone={rowStatus(row) === 'Success' ? 'success' : rowStatus(row) === 'Warning' ? 'attention' : 'critical'}>{rowStatus(row)}</Status></td>
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
