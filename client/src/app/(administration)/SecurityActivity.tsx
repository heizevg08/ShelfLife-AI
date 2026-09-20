'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';

const tabs = [
  'Overview',
  'Audit Logs',
  'Active Sessions',
] as const;

type SecurityTab = (typeof tabs)[number];

function PlaceholderBadge() {
  return null;
}

function SecurityPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-staff-usage-pending${compact ? ' compact' : ''}`}>
      <DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} />
    </div>
  );
}

function OverviewPanel({ onNavigate }: { onNavigate: (tab: SecurityTab) => void }) {
  return (
    <div className="sl-staff-usage-layout">
      <main className="sl-staff-usage-main">
        <section className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="recent-security-activity-title">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
            <h2 id="recent-security-activity-title">Recent Security &amp; System Activity</h2>
            <div className="sl-staff-usage-head-actions"><button type="button" className="sl-staff-usage-viewall sl-v209-viewall-button" onClick={() => onNavigate('Audit Logs')}>View All <ArrowRight size={14} aria-hidden="true" /></button></div>
          </header>
          <div className="sl-staff-usage-table-shell">
            <table className="sl-data-table sl-staff-usage-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Activity</th><th>Module</th><th>Status</th></tr></thead>
              <tbody><tr className="sl-staff-usage-preview-row"><td colSpan={5} className="sl-staff-usage-preview-state-cell"><SecurityPending label="Security and system activity" /></td></tr></tbody>
            </table>
          </div>
        </section>

        <section className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="active-sessions-title">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><Monitor aria-hidden="true" /></span>
            <h2 id="active-sessions-title">Active Sessions</h2>
            <div className="sl-staff-usage-head-actions"><button type="button" className="sl-staff-usage-viewall sl-v209-viewall-button" onClick={() => onNavigate('Active Sessions')}>View All <ArrowRight size={14} aria-hidden="true" /></button></div>
          </header>
          <div className="sl-staff-usage-table-shell">
            <table className="sl-data-table sl-staff-usage-table">
              <thead><tr><th>User</th><th>Role</th><th>Login Time</th><th>Last Activity</th><th>Actions</th></tr></thead>
              <tbody><tr className="sl-staff-usage-preview-row"><td colSpan={5} className="sl-staff-usage-preview-state-cell"><SecurityPending label="Active sessions" /></td></tr></tbody>
            </table>
          </div>
        </section>
      </main>

      <aside className="sl-staff-usage-rail">
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><ShieldCheck aria-hidden="true" /></span><h2>Security Status</h2></header>
          <div className="sl-v207-security-distribution" aria-label="Security status distribution with no live values yet">
            <div className="sl-v207-security-donut" aria-hidden="true"><strong>—</strong></div>
            <div className="sl-v207-security-legend">
              <div><span className="sl-v207-security-dot is-secure" /><span>Secure</span><strong>—</strong></div>
              <div><span className="sl-v207-security-dot is-attention" /><span>Attention</span><strong>—</strong></div>
              <div><span className="sl-v207-security-dot is-risk" /><span>Risk</span><strong>—</strong></div>
              <div><span className="sl-v207-security-dot is-critical" /><span>Critical</span><strong>—</strong></div>
            </div>
          </div>
        </section>
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><BarChart3 aria-hidden="true" /></span><h2>Top Security Events (7 Days)</h2></header>
          <div className="sl-v206-events-chart" aria-label="Top security events chart preview with no live values yet">
            {['Authentication','Access Control','Account Changes','System Settings','Audit Events'].map((label, index) => (
              <div className="sl-v206-event-row" key={label}>
                <div><span>{label}</span><strong>—</strong></div>
                <span className={`sl-v206-event-track tone-${index + 1}`} aria-hidden="true"><i /></span>
              </div>
            ))}
            <small>Live values will populate when security-event analytics are connected.</small>
          </div>
        </section>
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon attention"><AlertTriangle aria-hidden="true" /></span><h2>Security Alerts</h2></header>
          <SecurityPending label="Security alerts" compact />
        </section>
      </aside>
    </div>
  );
}

function AuditLogsPanel() {
  const [auditDateRange, setAuditDateRange] = useState('any');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');

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
                <input type="search" placeholder="User, action, module, or details…" />
              </div>
            </label>
            <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={auditDateRange} onChange={event => setAuditDateRange(event.target.value)} aria-label="Audit log date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
            {auditDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom audit log date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={auditFrom} max={auditTo || undefined} onChange={event => setAuditFrom(event.target.value)} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={auditTo} min={auditFrom || undefined} onChange={event => setAuditTo(event.target.value)} /></label></div>}
            <label className="sl-v203-filter-field"><span>Role</span><select defaultValue="all"><option value="all">All Roles</option><option value="super-admin">Super Admin</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="inventory-staff">Inventory Staff</option></select></label>
            <label className="sl-v203-filter-field"><span>Action</span><select defaultValue="all" aria-label="Audit log action"><option value="all">All Actions</option><option value="created">Created</option><option value="updated">Updated</option><option value="deleted">Deleted</option><option value="approved">Approved</option><option value="login">Login</option><option value="exported">Exported</option><option value="rejected">Rejected</option></select></label>
            <label className="sl-v203-filter-field"><span>Module</span><select defaultValue="all" aria-label="Audit log module"><option value="all">All Modules</option><option value="dashboard">Dashboard</option><option value="users">Users</option><option value="security-activity">Security &amp; Activity</option><option value="system-settings">System Settings</option><option value="ingredients">Ingredients</option><option value="inventory-batches">Inventory Batches</option><option value="inventory">Inventory</option><option value="stock-in">Stock-In</option><option value="usage">Usage</option><option value="usage-waste">Usage &amp; Waste</option><option value="usage-recording">Usage Recording</option><option value="waste">Waste</option><option value="waste-recording">Waste Recording</option><option value="change-requests">Change Requests</option><option value="my-requests">My Requests</option><option value="expiration-fefo">Expiration / FEFO</option><option value="forecasting">Forecasting</option><option value="alerts">Alerts</option><option value="audit-logs">Audit Logs</option><option value="reports">Reports</option><option value="reports-analytics">Reports &amp; Analytics</option></select></label>
            <div className="sl-v203-filter-actions">
              <button type="button" className="sl-button">Reset</button>
            </div>
          </div>

          <div className="sl-v203-audit-table-wrap" role="region" aria-label="Audit records" tabIndex={0}>
            <table className="sl-data-table sl-v203-audit-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Details</th><th>Status</th></tr></thead>
            </table>
            <div className="sl-staff-usage-pending">
              <DataState kind="empty" title="No live records yet" description="Audit records" />
              <PlaceholderBadge />
            </div>
          </div>

          <footer className="sl-staff-usage-footer sl-v203-audit-footer">
            <label><span>Rows per page</span><select defaultValue="10"><option>10</option><option>15</option><option>50</option><option>100</option><option>150</option></select></label>
            <span className="sl-staff-usage-pagination-note">No live records yet</span>
          </footer>
        </section>
      </main>

    </div>
  );
}

function ActiveSessionsPanel() {
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
            <label className="sl-v203-filter-field"><span>Status</span><select defaultValue="active"><option value="active">Active</option><option value="idle">Idle</option><option value="suspended">Suspended</option><option value="logged-out">Logged Out</option></select></label>
            <div className="sl-v203-filter-actions">
              <button type="button" className="sl-button">Reset</button>
            </div>
          </div>

          <div className="sl-v203-audit-table-wrap" role="region" aria-label="Active session records" tabIndex={0}>
            <table className="sl-data-table sl-v203-audit-table sl-v211-session-table">
              <colgroup><col /><col /><col /><col /><col /></colgroup>
              <thead><tr><th>User</th><th>Role</th><th>Login Time</th><th>Last Activity</th><th>Actions</th></tr></thead>
            </table>
            <div className="sl-staff-usage-pending">
              <DataState kind="empty" title="No live records yet" description="Active sessions" />
              <PlaceholderBadge />
            </div>
          </div>

          <footer className="sl-staff-usage-footer sl-v203-audit-footer">
            <label><span>Rows per page</span><select defaultValue="10"><option>10</option><option>15</option><option>50</option><option>100</option><option>150</option></select></label>
            <span className="sl-staff-usage-pagination-note">No live records yet</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function GenericPlaceholder({ title }: { title: string }) {
  return (
    <section className="sl-v78-card">
      <div className="sl-v78-state-wrap">
        <DataState
          kind="empty"
          title="No live records yet"
          description={`${title} will appear here when the backend connection is available.`}
        />
        <p className="sl-v79-context-copy">{title}</p>
        <PlaceholderBadge />
      </div>
    </section>
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
    <div className="sl-security-activity-v78 sl-staff-usage-v150" data-ui-version="v199-superadmin-dashboard-kpi-parity">
      <PageHeader
        eyebrow="Security & Activity"
        title="Security & Activity"
        description="Monitor system security, user activity, and audit records across ShelfLife AI."
      />

      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Security overview">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><ShieldCheck aria-hidden="true" /></span>
          <div><span>Total Users</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info">
          <span className="sl-sa-kpi-icon"><UsersRound aria-hidden="true" /></span>
          <div><span>Active Sessions</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><FileText aria-hidden="true" /></span>
          <div><span>Audit Logs (30 Days)</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div><span>Security Alerts</span><strong>—</strong><small>Preview · data pending</small></div>
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
