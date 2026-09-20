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
  LogIn,
  Monitor,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  LaptopMinimal,
  Globe2,
} from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';

const tabs = [
  'Overview',
  'Audit Logs',
  'Login Activity',
  'Active Sessions',
  'Security Alerts',
  'Access Control',
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

function OverviewPanel() {
  return (
    <div className="sl-staff-usage-layout">
      <main className="sl-staff-usage-main">
        <section className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="recent-security-activity-title">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
            <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
            <h2 id="recent-security-activity-title">Recent Security &amp; System Activity</h2>
            <div className="sl-staff-usage-head-actions"><span className="sl-staff-usage-viewall">View All</span></div>
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
            <div className="sl-staff-usage-head-actions"><span className="sl-staff-usage-viewall">View All</span></div>
          </header>
          <div className="sl-staff-usage-table-shell">
            <table className="sl-data-table sl-staff-usage-table">
              <thead><tr><th>User</th><th>Role</th><th>Device</th><th>IP Address</th><th>Last Activity</th></tr></thead>
              <tbody><tr className="sl-staff-usage-preview-row"><td colSpan={5} className="sl-staff-usage-preview-state-cell"><SecurityPending label="Active sessions" /></td></tr></tbody>
            </table>
          </div>
        </section>
      </main>

      <aside className="sl-staff-usage-rail">
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><ShieldCheck aria-hidden="true" /></span><h2>Security Status</h2></header>
          <SecurityPending label="Security status" compact />
        </section>
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><BarChart3 aria-hidden="true" /></span><h2>Top Security Events (7 Days)</h2></header>
          <SecurityPending label="Security event analytics" compact />
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
            <label className="sl-v203-filter-field"><span>Date Range</span><input type="text" readOnly value="Data pending" /></label>
            <label className="sl-v203-filter-field"><span>User</span><select defaultValue="all"><option value="all">All Users</option></select></label>
            <label className="sl-v203-filter-field"><span>Action</span><select defaultValue="all"><option value="all">All Actions</option></select></label>
            <label className="sl-v203-filter-field"><span>Module</span><select defaultValue="all"><option value="all">All Modules</option></select></label>
            <div className="sl-v203-filter-actions">
              <button type="button" className="sl-button sl-button-primary"><Filter size={14} aria-hidden="true" /> Filter</button>
              <button type="button" className="sl-button">Reset</button>
            </div>
          </div>

          <div className="sl-v203-audit-table-wrap" role="region" aria-label="Audit records" tabIndex={0}>
            <table className="sl-data-table sl-v203-audit-table">
              <thead><tr><th>Date &amp; Time</th><th>User</th><th>Action</th><th>Module</th><th>Details</th><th>Status</th></tr></thead>
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

      <aside className="sl-v203-audit-rail">
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span><h2>Audit Log Overview</h2></header>
          <SecurityPending label="Audit log overview" compact />
        </section>
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><BarChart3 aria-hidden="true" /></span><h2>Activity by Module</h2></header>
          <SecurityPending label="Activity by module" compact />
        </section>
        <section className="sl-staff-usage-card sl-staff-usage-sidecard">
          <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><Activity aria-hidden="true" /></span><h2>Recent Security Activities</h2></header>
          <SecurityPending label="Recent security activities" compact />
        </section>
      </aside>
    </div>
  );
}

function LoginActivityPanel() {
  return (
    <div className="sl-v79-login-layout">
      <main className="sl-v79-login-main">
        <section className="sl-v78-card sl-v79-login-workspace">
          <div className="sl-v79-login-filters" aria-label="Login activity filters">
            <label className="sl-v79-login-search">
              <span>Search logs</span>
              <div>
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Search by user email, IP address, or device…" />
              </div>
            </label>

            <label>
              <span>User Role</span>
              <select defaultValue="all"><option value="all">All Roles</option></select>
            </label>

            <label>
              <span>Branch</span>
              <select defaultValue="all"><option value="all">All Branches</option></select>
            </label>

            <label>
              <span>Login Result</span>
              <select defaultValue="all"><option value="all">All Results</option></select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-v79-login-date">
                <CalendarDays size={15} aria-hidden="true" />
                <input type="text" readOnly value="Data pending" />
              </div>
            </label>

            <div className="sl-v79-login-filter-actions">
              <button type="button" className="sl-v78-filter-button"><Filter size={14} aria-hidden="true" /> Filter</button>
              <button type="button" className="sl-v78-reset-button">Reset</button>
            </div>
          </div>

          <div className="sl-v79-login-toolbar">
            <span>Showing records</span>
            <button type="button" disabled>Export</button>
          </div>

          <div className="sl-v79-login-table">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Login activity"
            />
            <PlaceholderBadge />
          </div>

          <footer className="sl-v79-login-footer">
            <label>
              <span>Rows per page</span>
              <select defaultValue="10"><option>10</option></select>
            </label>
            <span>Pagination will activate when live login records are available.</span>
          </footer>
        </section>
      </main>

      <aside className="sl-v79-login-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Activity size={16} aria-hidden="true" /></span>
              <div>
                <h2>Login Activity Overview</h2>
                <p>Sign-in activity across all branches.</p>
              </div>
            </div>
          </header>

          <div className="sl-v79-periods">
            <button type="button" className="is-active">7 Days</button>
            <button type="button">30 Days</button>
            <button type="button">This Month</button>
          </div>

          <div className="sl-v82-login-overview-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Login activity overview"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><BarChart3 size={16} aria-hidden="true" /></span>
              <div>
                <h2>Login Attempts Trend</h2>
                <p>Successful versus failed logins.</p>
              </div>
            </div>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Login activity trend"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><UserRoundCheck size={16} aria-hidden="true" /></span>
              <div>
                <h2>Login Attempts by Role</h2>
                <p>Authentication activity by user role.</p>
              </div>
            </div>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Login attempts by role"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><FileText size={16} aria-hidden="true" /></span>
              <div>
                <h2>Recent Login Activity</h2>
                <p>Latest sign-in attempts in the system.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Recent login activity"
            />
            <PlaceholderBadge />
          </div>
        </section>
      </aside>
    </div>
  );
}

function ActiveSessionsPanel() {
  return (
    <div className="sl-v81-sessions-layout">
      <main className="sl-v81-sessions-main">
        <section className="sl-v78-card sl-v80-sessions-workspace">
        <div className="sl-v80-sessions-filters" aria-label="Active session filters">
          <label className="sl-v80-sessions-search">
            <span>Search sessions</span>
            <div>
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Search by user, email, or session ID…" />
            </div>
          </label>

          <label>
            <span>User Role</span>
            <select defaultValue="all"><option value="all">All Roles</option></select>
          </label>

          <label>
            <span>Branch</span>
            <select defaultValue="all"><option value="all">All Branches</option></select>
          </label>

          <label>
            <span>Device</span>
            <select defaultValue="all"><option value="all">All Devices</option></select>
          </label>

          <label>
            <span>Status</span>
            <select defaultValue="active"><option value="active">Active Only</option></select>
          </label>

          <div className="sl-v80-sessions-filter-actions">
            <button type="button" className="sl-v78-filter-button"><Filter size={14} aria-hidden="true" /> Filter</button>
            <button type="button" className="sl-v78-reset-button">Reset</button>
          </div>
        </div>

        <div className="sl-v80-sessions-toolbar">
          <span>Showing session records</span>
          <button type="button" disabled>Export</button>
        </div>

        <div className="sl-v80-sessions-table">
          <DataState
            kind="empty"
            title="No live records yet"
            description="Active sessions"
          />
          <PlaceholderBadge />
        </div>

        <footer className="sl-v80-sessions-footer">
          <label>
            <span>Rows per page</span>
            <select defaultValue="10"><option>10</option></select>
          </label>
          <span>Pagination will activate when live session records are available.</span>
        </footer>
        </section>
      </main>

      <aside className="sl-v81-sessions-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Globe2 size={16} aria-hidden="true" /></span>
              <div>
                <h2>Session Distribution</h2>
                <p>Active sessions by branch.</p>
              </div>
            </div>
          </header>

          <div className="sl-v81-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Session distribution"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><LaptopMinimal size={16} aria-hidden="true" /></span>
              <div>
                <h2>Device Distribution</h2>
                <p>Active sessions by device type.</p>
              </div>
            </div>
          </header>

          <div className="sl-v81-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Device distribution"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Activity size={16} aria-hidden="true" /></span>
              <div>
                <h2>Recent Session Activity</h2>
                <p>Latest session events across all branches.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>

          <div className="sl-v81-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Recent session activity"
            />
            <PlaceholderBadge />
          </div>
        </section>
      </aside>
    </div>
  );
}


function SecurityAlertsPanel() {
  return (
    <div className="sl-v84-alerts-layout">
      <main className="sl-v84-alerts-main">
        <section className="sl-v78-card sl-v84-alerts-workspace">
          <div className="sl-v84-alerts-filters" aria-label="Security alerts filters">
            <label className="sl-v84-alerts-search">
              <span>Search security events</span>
              <div>
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Search by event type, user, IP, or details…" />
              </div>
            </label>

            <label>
              <span>Severity</span>
              <select defaultValue="all"><option value="all">All Severities</option></select>
            </label>

            <label>
              <span>Event Type</span>
              <select defaultValue="all"><option value="all">All Types</option></select>
            </label>

            <label>
              <span>Status</span>
              <select defaultValue="all"><option value="all">All Statuses</option></select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-v84-alerts-date">
                <CalendarDays size={15} aria-hidden="true" />
                <input type="text" readOnly value="Data pending" />
              </div>
            </label>

            <div className="sl-v84-alerts-filter-actions">
              <button type="button" className="sl-v78-filter-button">
                <Filter size={14} aria-hidden="true" /> Filter
              </button>
              <button type="button" className="sl-v78-reset-button">Reset</button>
            </div>
          </div>

          <div className="sl-v84-alerts-toolbar">
            <span>Security event records</span>
            <button type="button" disabled>Export</button>
          </div>

          <div className="sl-v84-alerts-table">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Security alerts"
            />
            <PlaceholderBadge />
          </div>

          <footer className="sl-v84-alerts-footer">
            <label>
              <span>Rows per page</span>
              <select defaultValue="10"><option>10</option></select>
            </label>
            <span>Pagination will activate when live security-event records are available.</span>
          </footer>
        </section>
      </main>

      <aside className="sl-v84-alerts-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><BarChart3 size={16} aria-hidden="true" /></span>
              <div>
                <h2>Security Events Trend</h2>
                <p>Number of security events over time.</p>
              </div>
            </div>
          </header>

          <div className="sl-v84-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Security events trend"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><ShieldCheck size={16} aria-hidden="true" /></span>
              <div>
                <h2>Events by Type</h2>
                <p>Distribution of security event categories.</p>
              </div>
            </div>
          </header>

          <div className="sl-v84-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Security events by type"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><UsersRound size={16} aria-hidden="true" /></span>
              <div>
                <h2>Top Affected Users</h2>
                <p>Users involved in the most security events.</p>
              </div>
            </div>
          </header>

          <div className="sl-v84-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Affected users"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><AlertTriangle size={16} aria-hidden="true" /></span>
              <div>
                <h2>Recent Critical Events</h2>
                <p>Latest high-impact security events.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>

          <div className="sl-v84-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Critical security events"
            />
            <PlaceholderBadge />
          </div>
        </section>
      </aside>
    </div>
  );
}



function AccessControlPanel() {
  return (
    <div className="sl-v86-access-layout">
      <main className="sl-v86-access-main">
        <section className="sl-v78-card sl-v86-access-workspace">
          <div className="sl-v86-access-filters" aria-label="Access control filters">
            <label className="sl-v86-access-search">
              <span>Search roles or permissions</span>
              <div>
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Search role, permission, or module…" />
              </div>
            </label>

            <label>
              <span>Role</span>
              <select defaultValue="all"><option value="all">All Roles</option></select>
            </label>

            <label>
              <span>Module</span>
              <select defaultValue="all"><option value="all">All Modules</option></select>
            </label>

            <label>
              <span>Permission Type</span>
              <select defaultValue="all"><option value="all">All Types</option></select>
            </label>

            <label>
              <span>Status</span>
              <select defaultValue="all"><option value="all">All Statuses</option></select>
            </label>

            <div className="sl-v86-access-filter-actions">
              <button type="button" className="sl-v78-filter-button">
                <Filter size={14} aria-hidden="true" /> Filter
              </button>
              <button type="button" className="sl-v78-reset-button">Reset</button>
            </div>
          </div>

          <div className="sl-v86-access-toolbar">
            <span>Access-control records</span>
            <button type="button" disabled>Export</button>
          </div>

          <div className="sl-v86-access-table">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Access control permissions"
            />
            <PlaceholderBadge />
          </div>

          <footer className="sl-v86-access-footer">
            <label>
              <span>Rows per page</span>
              <select defaultValue="10"><option>10</option></select>
            </label>
            <span>Pagination will activate when live permission records are available.</span>
          </footer>
        </section>
      </main>

      <aside className="sl-v86-access-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><UsersRound size={16} aria-hidden="true" /></span>
              <div>
                <h2>Role Distribution</h2>
                <p>Number of users per role.</p>
              </div>
            </div>
          </header>

          <div className="sl-v86-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Role distribution"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><ShieldCheck size={16} aria-hidden="true" /></span>
              <div>
                <h2>Module Permissions</h2>
                <p>Number of permissions per module.</p>
              </div>
            </div>
          </header>

          <div className="sl-v86-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Module permissions"
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Activity size={16} aria-hidden="true" /></span>
              <div>
                <h2>Recent Access Changes</h2>
                <p>Latest changes to roles and permissions.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>

          <div className="sl-v86-rail-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Access-control changes"
            />
            <PlaceholderBadge />
          </div>
        </section>
      </aside>
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
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Overview' && <OverviewPanel />}
      {activeTab === 'Audit Logs' && <AuditLogsPanel />}
      {activeTab === 'Login Activity' && <LoginActivityPanel />}
      {activeTab === 'Active Sessions' && <ActiveSessionsPanel />}
      {activeTab === 'Security Alerts' && <SecurityAlertsPanel />}
      {activeTab === 'Access Control' && <AccessControlPanel />}
    </div>
  );
}
