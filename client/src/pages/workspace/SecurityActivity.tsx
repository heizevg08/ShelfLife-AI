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
import { DataState, PageHeader } from '../../components/application/primitives';

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
  return <span className="sl-v78-preview-badge">Preview · data pending</span>;
}

function OverviewPanel() {
  return (
    <div className="sl-v78-layout">
      <main className="sl-v78-main">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><FileText size={16} aria-hidden="true" /></span>
              <div>
                <h2>Recent Security &amp; System Activity</h2>
                <p>Latest critical and notable activities across the system.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all logs →</span>
          </header>
          <div className="sl-v78-state-wrap">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Security and system activity will appear here when the audit-event backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Monitor size={16} aria-hidden="true" /></span>
              <div>
                <h2>Active Sessions</h2>
                <p>Currently active user sessions.</p>
              </div>
            </div>
            <span className="sl-v78-linklike">View all sessions →</span>
          </header>
          <div className="sl-v78-state-wrap">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Active sessions will appear here when the session-monitoring backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>
      </main>

      <aside className="sl-v78-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><ShieldCheck size={16} aria-hidden="true" /></span>
              <div><h2>Security Status</h2><p>Overall system security health and risk level.</p></div>
            </div>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="Security status unavailable"
              description="Live risk and health metrics will appear here when the security-status backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><BarChart3 size={16} aria-hidden="true" /></span>
              <div><h2>Top Security Events (7 days)</h2></div>
            </div>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Security event analytics will appear here when the analytics backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><AlertTriangle size={16} aria-hidden="true" /></span>
              <div><h2>Security Alerts</h2></div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live alerts yet"
              description="Security alerts will appear here when the alert backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>
      </aside>
    </div>
  );
}

function AuditLogsPanel() {
  return (
    <div className="sl-v78-audit-layout">
      <main className="sl-v78-audit-main">
        <section className="sl-v78-card sl-v78-audit-workspace">
          <div className="sl-v78-audit-filters" aria-label="Audit log filters">
            <label className="sl-v78-search-field">
              <span>Search logs</span>
              <div>
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="User, action, module, or details…" />
              </div>
            </label>

            <label>
              <span>Date Range</span>
              <input type="text" readOnly value="Data pending" />
            </label>

            <label>
              <span>User</span>
              <select defaultValue="all"><option value="all">All Users</option></select>
            </label>

            <label>
              <span>Action</span>
              <select defaultValue="all"><option value="all">All Actions</option></select>
            </label>

            <label>
              <span>Module</span>
              <select defaultValue="all"><option value="all">All Modules</option></select>
            </label>

            <div className="sl-v78-filter-actions">
              <button type="button" className="sl-v78-filter-button"><Filter size={14} aria-hidden="true" /> Filter</button>
              <button type="button" className="sl-v78-reset-button">Reset</button>
            </div>
          </div>

          <div className="sl-v78-audit-toolbar">
            <span>Audit records</span>
            <button type="button" disabled>Export</button>
          </div>

          <div className="sl-v78-audit-placeholder">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Audit-log rows will appear here when the protected audit backend is connected."
            />
            <PlaceholderBadge />
          </div>

          <footer className="sl-v78-audit-footer">
            <label>
              <span>Rows per page</span>
              <select defaultValue="10"><option>10</option></select>
            </label>
            <span>Pagination will activate when live records are available.</span>
          </footer>
        </section>
      </main>

      <aside className="sl-v78-audit-rail">
        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><FileText size={16} aria-hidden="true" /></span>
              <div><h2>Audit Log Overview</h2><p>Summary of system activities across all branches.</p></div>
            </div>
          </header>
          <div className="sl-v78-mini-kpis">
            <article><span>Total Logs</span><strong>—</strong><small>Awaiting audit summary API</small></article>
            <article><span>Successful Actions</span><strong>—</strong><small>Data pending</small></article>
            <article><span>Failed Actions</span><strong>—</strong><small>Data pending</small></article>
            <article><span>Security Events</span><strong>—</strong><small>Data pending</small></article>
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><BarChart3 size={16} aria-hidden="true" /></span>
              <div><h2>Activity by Module</h2><p>Number of logs per module.</p></div>
            </div>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Module-level audit distribution will appear here when the audit analytics backend is connected."
            />
            <PlaceholderBadge />
          </div>
        </section>

        <section className="sl-v78-card">
          <header className="sl-v78-card-head compact">
            <div className="sl-v78-head-left">
              <span className="sl-v78-round-icon"><Activity size={16} aria-hidden="true" /></span>
              <div><h2>Recent Security Events</h2></div>
            </div>
            <span className="sl-v78-linklike">View all →</span>
          </header>
          <div className="sl-v78-state-wrap compact">
            <DataState
              kind="empty"
              title="No live records yet"
              description="Recent security events will appear here when the event backend is connected."
            />
            <PlaceholderBadge />
          </div>
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
    <div className="sl-security-activity-v78" data-ui-version="v86-security-activity-access-control">
      <PageHeader
        eyebrow="Security & Activity"
        title="Security & Activity"
        description="Monitor system security, user activity, and audit records across ShelfLife AI."
      />

      <section className="sl-v78-kpis" aria-label="Security overview">
        <article>
          <span className="sl-v78-kpi-icon is-brand"><ShieldCheck aria-hidden="true" /></span>
          <div><span>Total Users</span><strong>—</strong><small>Awaiting user summary API</small></div>
        </article>
        <article>
          <span className="sl-v78-kpi-icon is-success"><UsersRound aria-hidden="true" /></span>
          <div><span>Active Sessions</span><strong>—</strong><small>Awaiting session service</small></div>
        </article>
        <article>
          <span className="sl-v78-kpi-icon is-critical"><AlertTriangle aria-hidden="true" /></span>
          <div><span>Security Alerts</span><strong>—</strong><small>Awaiting security alerts API</small></div>
        </article>
        <article>
          <span className="sl-v78-kpi-icon is-info"><FileText aria-hidden="true" /></span>
          <div><span>Audit Logs (30 days)</span><strong>—</strong><small>Awaiting audit summary API</small></div>
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
