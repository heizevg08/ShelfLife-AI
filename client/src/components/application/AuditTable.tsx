import { ChevronDown, Download, Filter, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAuditRecords, type AuditFilters, type AuditRecord, type Page } from '../../services/administration';
import { administrationFilterCatalog } from './administration';
import { reportExportFormats } from './module-content';
import { DataState } from './primitives';

const AUTO_REFRESH_MS = 15000;
const auditActionByLabel: Record<string, AuditFilters['action']> = {
  'Account created': 'CREATE',
  'Account updated': 'UPDATE',
  'Account deactivated': 'DEACTIVATE',
  'Account reactivated': 'REACTIVATE',
};

export function AuditTable({ recent = false }: { recent?: boolean }) {
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

  useEffect(() => {
    const abort = new AbortController();
    if (!data) setError(false);
    const cutoffDays = periodFilter === 'Last 7 days' ? 7 : periodFilter === 'Last 30 days' ? 30 : periodFilter === 'Last 90 days' ? 90 : 0;
    const filters: AuditFilters = recent ? {} : {
      actorRole: actorFilter ? actorFilter as AuditFilters['actorRole'] : undefined,
      action: actionFilter ? auditActionByLabel[actionFilter] : undefined,
      from: cutoffDays ? new Date(Date.now() - cutoffDays * 86400000).toISOString() : undefined,
    };
    listAuditRecords(page, recent ? 5 : 25, 'desc', filters, abort.signal)
      .then(value => { if (!abort.signal.aborted) { setData(value); setLastUpdatedAt(new Date()); } })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [page, refresh, recent, actorFilter, actionFilter, periodFilter]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const actorOptions = [...administrationFilterCatalog.audit.actor];
  const actionOptions = [...administrationFilterCatalog.audit.action];
  const rows = data?.items ?? [];
  const filtersApplied = !!actorFilter || !!actionFilter || periodFilter !== administrationFilterCatalog.audit.period[0];

  const lastUpdatedLabel = lastUpdatedAt
    ? `Last updated: ${lastUpdatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`
    : 'Last updated: waiting for data';

  return <>
    {!recent && <div className="sl-table-toolbar sl-audit-toolbar">
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
              <label>Actor
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

    {error ? <DataState kind="error" title="Activity could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(x => x + 1)}>Retry</button>} />
      : !data ? <DataState kind="loading" title="Loading activity" description="" />
      : <div className="sl-table-scroll" role="region" aria-label="Administrative audit records" tabIndex={0}>
        <table className="sl-data-table">
          <thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Target</th></tr></thead>
          <tbody>
            {!rows.length && <tr><td colSpan={4} className="sl-empty-cell"><DataState kind="empty" title={filtersApplied ? 'No records match these filters' : 'No administrative activity yet'} description={filtersApplied ? 'Change or clear the current filters.' : "You're all caught up — successful account changes will show up here automatically."} /></td></tr>}
            {rows.map(row => <tr key={row.id}>
              <td><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString(undefined, { hour12: true })}</time></td>
              <td className="sl-record-id">{row.actor.name} · {row.actor.role}</td>
              <td>{row.action}</td>
              <td><span>{row.targetType}</span><div className="sl-record-id">{row.targetId}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>}

    {!recent && data && <>
      <div className="sl-audit-export-row">
        <div className="sl-download-control">
          <button
            type="button"
            className="sl-button sl-download-trigger"
            aria-expanded={downloadOpen}
            aria-controls="sl-audit-download-menu"
            onClick={() => setDownloadOpen(value => !value)}
          >
            <Download size={17} aria-hidden="true" />
            Export
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {downloadOpen && <div id="sl-audit-download-menu" className="sl-download-menu" role="menu" aria-label="Audit export formats">
            {reportExportFormats.map(format => <button key={format.id} type="button" role="menuitem" disabled className="sl-download-option"><span>{format.label}</span></button>)}
            <p className="sl-supporting">Exports activate when the audit export service and permissions are available.</p>
          </div>}
        </div>
      </div>
      <div className="sl-table-toolbar sl-pagination"><span className="sl-supporting">{data.total} records · Page {page}</span><div className="sl-row-actions"><button className="sl-button" disabled={page === 1} onClick={() => setPage(x => x - 1)}>Previous</button><button className="sl-button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(x => x + 1)}>Next</button></div></div>
    </>}
  </>;
}
