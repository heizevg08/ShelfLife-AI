'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Filter,
  Monitor,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  Globe2,
  ArrowRight,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ExportControl, PageHeader, Pagination } from '../../components/application/primitives';
import { listAuditRecords, type AuditRecord, type Page } from '../../services/administration';
import { formatDateTime } from '../../utils/date-time';

const tabs = [
  'Overview',
  'Audit Logs',
  'Active Sessions',
] as const;

type SecurityTab = (typeof tabs)[number];

function OverviewPanel({ onNavigate }: { onNavigate: (tab: SecurityTab) => void }) {
  return (
    <div className="sl-security-overview-panel">
      <main className="sl-staff-usage-main">
        <section className="sl-staff-usage-card sl-staff-usage-records sl-security-overview-records" aria-labelledby="recent-security-activity-title">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
            <h2 id="recent-security-activity-title">Recent Security &amp; System Activity</h2>
            <div className="sl-staff-usage-head-actions"><button type="button" className="sl-staff-usage-viewall sl-v209-viewall-button" onClick={() => onNavigate('Audit Logs')}>View All <ArrowRight size={14} aria-hidden="true" /></button></div>
          </header>
          <div className="sl-staff-usage-table-shell">
            <table className="sl-data-table sl-staff-usage-table sl-security-overview-table sl-security-overview-activity-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Activity</th><th>Module</th><th>Status</th></tr></thead>
              <tbody><tr className="sl-security-overview-empty-row" aria-label="No recent security or system activity available">{Array.from({ length: 5 }).map((_, index) => <td key={index}>—</td>)}</tr></tbody>
            </table>
          </div>
        </section>

        <section className="sl-staff-usage-card sl-staff-usage-records sl-security-overview-records" aria-labelledby="active-sessions-title">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><Monitor aria-hidden="true" /></span>
            <h2 id="active-sessions-title">Active Sessions</h2>
            <div className="sl-staff-usage-head-actions"><button type="button" className="sl-staff-usage-viewall sl-v209-viewall-button" onClick={() => onNavigate('Active Sessions')}>View All <ArrowRight size={14} aria-hidden="true" /></button></div>
          </header>
          <div className="sl-staff-usage-table-shell">
            <table className="sl-data-table sl-staff-usage-table sl-security-overview-table sl-security-overview-sessions-table">
              <thead><tr><th>User</th><th>Role</th><th>Login Time</th><th>Last Activity</th><th>Actions</th></tr></thead>
              <tbody><tr className="sl-security-overview-empty-row" aria-label="No active session records available">{Array.from({ length: 4 }).map((_, index) => <td key={index}>—</td>)}<td><button type="button" className="sl-button sl-icon-button" disabled aria-label="View session unavailable"><Eye size={16} aria-hidden="true" /></button></td></tr></tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function AuditLogsPanel() {
  const [auditDateRange, setAuditDateRange] = useState('any');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditData, setAuditData] = useState<Page<AuditRecord> | null>(null);
  const [auditError, setAuditError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const cutoffDays = auditDateRange === 'week' ? 7 : auditDateRange === 'month' ? 30 : auditDateRange === 'year' ? 365 : 0;
    const from = auditDateRange === 'custom' && auditFrom
      ? new Date(`${auditFrom}T00:00:00`).toISOString()
      : cutoffDays ? new Date(Date.now() - cutoffDays * 86400000).toISOString() : undefined;
    const to = auditDateRange === 'custom' && auditTo ? new Date(`${auditTo}T23:59:59.999`).toISOString() : undefined;

    setAuditError(false);
    listAuditRecords(auditPage, auditPageSize, 'desc', { from, to }, abort.signal)
      .then(value => { if (!abort.signal.aborted) setAuditData(value); })
      .catch(() => { if (!abort.signal.aborted) setAuditError(true); });
    return () => abort.abort();
  }, [auditDateRange, auditFrom, auditPage, auditPageSize, auditTo]);

  const auditRows = auditData?.items ?? [];

  return (
    <div className="sl-v203-audit-layout">
      <main className="sl-v203-audit-main">
        <section className="sl-staff-usage-card sl-v203-audit-records">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
            <h2>Audit Records</h2>
          </header>

          <div className="sl-staff-usage-toolbar sl-v203-audit-filters" aria-label="Audit log filters">
            <label className="sl-v203-filter-field sl-v203-search-field">
              <span>Search logs</span>
              <div className="sl-staff-usage-search">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Search user, action, module, or details..." />
              </div>
            </label>
            <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={auditDateRange} onChange={event => setAuditDateRange(event.target.value)} aria-label="Audit log date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
            {auditDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom audit log date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={auditFrom} max={auditTo || undefined} onChange={event => setAuditFrom(event.target.value)} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={auditTo} min={auditFrom || undefined} onChange={event => setAuditTo(event.target.value)} /></label></div>}
            <label className="sl-v203-filter-field"><span>Role</span><select defaultValue="all"><option value="all">All Roles</option><option value="super-admin">Super Admin</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="inventory-staff">Inventory Staff</option></select></label>
            <label className="sl-v203-filter-field"><span>Action</span><select defaultValue="all" aria-label="Audit log action"><option value="all">All Actions</option><option value="created">Created</option><option value="updated">Updated</option><option value="deleted">Deleted</option><option value="approved">Approved</option><option value="login">Login</option><option value="exported">Exported</option><option value="rejected">Rejected</option></select></label>
            <label className="sl-v203-filter-field"><span>Module</span><select defaultValue="all" aria-label="Audit log module"><option value="all">All Modules</option><option value="dashboard">Dashboard</option><option value="users">Users</option><option value="security-activity">Security &amp; Activity</option><option value="system-settings">System Settings</option><option value="ingredients">Ingredients</option><option value="inventory-batches">Inventory Batches</option><option value="inventory">Inventory</option><option value="stock-in">Stock-In</option><option value="usage">Usage</option><option value="usage-waste">Usage &amp; Waste</option><option value="usage-recording">Usage Recording</option><option value="waste">Waste</option><option value="waste-recording">Waste Recording</option><option value="change-requests">Change Requests</option><option value="my-requests">My Requests</option><option value="expiration-fefo">Expiration / FEFO</option><option value="forecasting">Forecasting</option><option value="alerts">Alerts</option><option value="audit-logs">Audit Logs</option><option value="reports">Reports</option><option value="reports-analytics">Reports &amp; Analytics</option></select></label>
            <div className="sl-v203-filter-actions">
              <button type="button" className="sl-button">Reset</button>
              <ExportControl label="Export" menuId="sl-sa-security-audit-export-menu" />
            </div>
          </div>

          <div className="sl-v203-audit-table-wrap" role="region" aria-label="Audit records" tabIndex={0}>
            <table className="sl-records-table sl-data-table sl-v203-audit-table sl-security-audit-records-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Details</th><th>Status</th></tr></thead>
              <tbody>
                {!auditData || auditError || !auditRows.length ? <tr className="sl-security-audit-empty-row" aria-label={auditError ? "Audit records unavailable" : !auditData ? "Audit records loading" : "No audit records available"}>
                  <td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td><td><span className="sl-security-audit-empty-value">—</span></td>
                </tr>
                : auditRows.map(record => <tr key={record.id}>
                  <td><time dateTime={record.timestamp}>{formatDateTime(record.timestamp)}</time></td>
                  <td>{record.actor.name}</td>
                  <td>{record.actor.role}</td>
                  <td>{record.action}</td>
                  <td>{record.targetType}</td>
                  <td>{record.targetId}</td>
                  <td>—</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <footer className="sl-records-footer sl-staff-usage-footer sl-v203-audit-footer">
            <label><span>Rows per page</span><select value={auditPageSize} aria-label="Rows per page" onChange={event => { setAuditPageSize(Number(event.target.value)); setAuditPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
            <Pagination compact page={auditData?.page ?? auditPage} pageSize={auditData?.pageSize ?? auditPageSize} total={auditData?.total ?? 0} itemLabel="audit records" onPageChange={setAuditPage} />
          </footer>
        </section>
      </main>

    </div>
  );
}

function ActiveSessionsPanel() {
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState(10);

  return (
    <div className="sl-v203-audit-layout sl-v211-active-sessions-layout">
      <main className="sl-v203-audit-main">
        <section className="sl-staff-usage-card sl-v203-audit-records sl-v211-active-sessions-records">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><Monitor aria-hidden="true" /></span>
            <h2>Active Sessions</h2>
          </header>

          <div className="sl-staff-usage-toolbar sl-v203-audit-filters sl-v211-session-filters" aria-label="Active session filters">
            <label className="sl-v203-filter-field sl-v203-search-field">
              <span>Search sessions</span>
              <div className="sl-staff-usage-search">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="User or role…" />
              </div>
            </label>
            <label className="sl-v203-filter-field"><span>Role</span><select defaultValue="all"><option value="all">All Roles</option><option value="super-admin">Super Admin</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="inventory-staff">Inventory Staff</option></select></label>
            <label className="sl-v203-filter-field"><span>Status</span><select defaultValue="active"><option value="active">Active</option><option value="idle">Idle</option><option value="logged-out">Logged Out</option></select></label>
            <div className="sl-v203-filter-actions">
              <button type="button" className="sl-button">Reset</button>
              <ExportControl label="Export" menuId="sl-sa-security-sessions-export-menu" />
            </div>
          </div>

          <div className="sl-v203-audit-table-wrap" role="region" aria-label="Active session records" tabIndex={0}>
            <table className="sl-records-table sl-data-table sl-v203-audit-table sl-v211-session-table">
              <colgroup><col /><col /><col /><col /><col /></colgroup>
              <thead><tr><th>User</th><th>Role</th><th>Login Time</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                <tr className="sl-v211-session-empty-row" aria-label="No active session records available">
                  <td><span className="sl-v211-session-empty-value">—</span></td><td><span className="sl-v211-session-empty-value">—</span></td><td><span className="sl-v211-session-empty-value">—</span></td><td><span className="sl-v211-session-empty-value">—</span></td>
                  <td>
                    <div className="sl-staff-waste-row-actions" aria-label="Session actions unavailable">
                      <button type="button" className="sl-icon-button" disabled aria-label="View session unavailable" title="View"><Eye size={16} aria-hidden="true" /></button>
                      <button type="button" className="sl-icon-button" disabled aria-label="Edit session unavailable" title="Edit"><Pencil size={16} aria-hidden="true" /></button>
                      <button type="button" className="sl-icon-button sl-staff-waste-delete sl-staff-usage-delete-action" disabled aria-label="End session unavailable" title="End session"><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer className="sl-records-footer sl-staff-usage-footer sl-v203-audit-footer">
            <label><span>Rows per page</span><select value={sessionPageSize} aria-label="Rows per page" onChange={event => { setSessionPageSize(Number(event.target.value)); setSessionPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
            <Pagination compact page={sessionPage} pageSize={sessionPageSize} total={0} itemLabel="sessions" onPageChange={setSessionPage} />
          </footer>
        </section>
      </main>
    </div>
  );
}

export default function SecurityActivity() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('Overview');
  const navigateTab = (tab: SecurityTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const hash = `#${tab.toLowerCase().replace(/\s+/g, '-')}`;
      window.history.replaceState(null, '', `/SecurityActivity${hash}`);
      window.requestAnimationFrame(() => document.getElementById('sl-security-tab-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <div className="sl-security-activity-v78 sl-staff-usage-v150" data-ui-version="dashboard-kpi-parity">
      <PageHeader
        eyebrow="Administration"
        title="Security & Activity"
        description="Monitor system security, user activity, and audit records across ShelfLife AI."
      />

      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Security overview">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><ShieldCheck aria-hidden="true" /></span>
          <div><span>Total Users</span><strong>—</strong><small>Account summary unavailable</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info">
          <span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span>
          <div><span>Active Sessions</span><strong>—</strong><small>Session service unavailable</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span>
          <div><span>Audit Logs (30 Days)</span><strong>—</strong><small>Audit summary unavailable</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div><span>Security Alerts</span><strong>—</strong><small>Security alert service unavailable</small></div>
        </article>
      </section>

      <nav className="sl-v78-tabs" aria-label="Security and activity sections">
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'is-active' : ''}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => navigateTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div id="sl-security-tab-content">
        {activeTab === 'Overview' && <OverviewPanel onNavigate={navigateTab} />}
        {activeTab === 'Audit Logs' && <AuditLogsPanel />}
        {activeTab === 'Active Sessions' && <ActiveSessionsPanel />}
      </div>
    </div>
  );
}
