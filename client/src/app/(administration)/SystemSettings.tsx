'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  Boxes,
  CalendarDays,
  Check,
  CircleAlert,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Database,
  EyeOff,
  FileImage,
  Globe2,
  HardDriveDownload,
  KeyRound,
  LockKeyhole,
  Mail,
  Megaphone,
  RefreshCw,
  MonitorSmartphone,
  Pencil,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  UserCheck,
  UserRoundCog,
  Wrench,
} from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';

const generalServices = [
  { label: 'Web Application', Icon: Globe2 },
  { label: 'API Server', Icon: Cloud },
  { label: 'Database (MongoDB Atlas)', Icon: Database },
  { label: 'File Storage (Cloudinary)', Icon: FileImage },
  { label: 'Email Service', Icon: Mail },
  { label: 'AI Forecasting Service', Icon: Bot },
];

const securityStatusItems = [
  'MFA Enforced',
  'Account Lockout Enabled',
  'Audit Logging Active',
  'Sensitive Data Encrypted',
  'Session Management Enabled',
];


const tabs = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'maintenance', label: 'System Maintenance' },
] as const;

type TabId = (typeof tabs)[number]['id'];

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <span className={`sl-v70-toggle ${defaultChecked ? 'is-on' : ''}`} aria-hidden="true">
      <span />
    </span>
  );
}

function SecurityRow({
  title,
  description,
  enabled = false,
}: {
  title: string;
  description: string;
  enabled?: boolean;
}) {
  return (
    <div className="sl-v70-switch-item">
      <div>
        <div className="sl-v70-switch-title">{title}</div>
        <p>{description}</p>
      </div>
      <Toggle defaultChecked={enabled} />
    </div>
  );
}

function GeneralPanel() {
  return (
    <div className="sl-v66-settings-grid">
      <section className="sl-v66-settings-panel" aria-labelledby="sl-v66-general-settings">
        <header className="sl-v66-panel-heading">
          <h2 id="sl-v66-general-settings">General Settings</h2>
          <p>Configure basic system information and preferences.</p>
        </header>

        <div className="sl-v66-form-grid">
          <label>
            <span>System Name</span>
            <input readOnly value="" placeholder="Configuration data pending" />
          </label>

          <label>
            <span>System Tagline</span>
            <input readOnly value="" placeholder="Configuration data pending" />
          </label>

          <label className="sl-v66-wide">
            <span>System Description</span>
            <textarea readOnly value="" placeholder="Configuration data pending" />
            <small>Configuration service required before this field can be edited.</small>
          </label>

          <label>
            <span>Time Zone</span>
            <select disabled value=""><option value="">Configuration data pending</option></select>
          </label>

          <label>
            <span>Date Format</span>
            <select disabled value=""><option value="">Configuration data pending</option></select>
          </label>

          <label>
            <span>Default Language</span>
            <select disabled value=""><option value="">Configuration data pending</option></select>
          </label>

          <label>
            <span>Currency</span>
            <select disabled value=""><option value="">Configuration data pending</option></select>
          </label>

          <div className="sl-v66-wide sl-v66-logo-setting">
            <span className="sl-v66-field-label">System Logo</span>

            <div className="sl-v66-logo-row">
              <div className="sl-v66-logo-preview">
                <div className="sl-v66-logo-mark" aria-hidden="true">S</div>
                <div>
                  <strong>ShelfLife AI</strong>
                  <span>System logo preview</span>
                </div>
              </div>

              <div className="sl-v66-logo-controls">
                <button type="button" disabled>
                  <FileImage size={15} aria-hidden="true" />
                  Change Logo
                </button>
                <button type="button" className="is-danger" disabled>
                  Remove
                </button>
                <small>Recommended image settings will be shown when the configuration service is connected.</small>
              </div>
            </div>
          </div>
        </div>

        <footer className="sl-v66-save-row">
          <p>Settings are read-only until the configuration API is connected.</p>
          <button type="button" disabled>Save Changes</button>
        </footer>
      </section>

      <aside className="sl-v66-settings-rail">
        <section className="sl-v66-rail-card">
          <header className="sl-v66-rail-heading">
            <h2>System Information</h2>
            <Pencil size={16} aria-hidden="true" />
          </header>

          <dl className="sl-v66-info-list">
            <div><dt>Application Version</dt><dd>—</dd></div>
            <div><dt>Environment</dt><dd><Status>Data pending</Status></dd></div>
            <div><dt>Last Updated</dt><dd>—</dd></div>
            <div><dt>Updated By</dt><dd>—</dd></div>
            <div><dt>Deployment Status</dt><dd><Status>Data pending</Status></dd></div>
          </dl>
        </section>

        <section className="sl-v66-rail-card">
          <header className="sl-v66-rail-heading">
            <h2>System Services</h2>
            <span className="sl-v66-linklike">View details <span aria-hidden="true">→</span></span>
          </header>

          <ul className="sl-v66-service-list">
            {generalServices.map(({ label, Icon }) => (
              <li key={label}>
                <span className="sl-v66-service-icon"><Icon size={14} aria-hidden="true" /></span>
                <span>{label}</span>
                <Status>Data pending</Status>
              </li>
            ))}
          </ul>
        </section>

        <section className="sl-v66-rail-card sl-v66-changes-card">
          <header className="sl-v66-rail-heading">
            <h2>Recent Configuration Changes</h2>
            <span className="sl-v66-linklike">View all <span aria-hidden="true">→</span></span>
          </header>

          <DataState
            kind="empty"
            title="No live records yet"
            description="Configuration activity will appear here when its audit source is connected."
          />
        </section>
      </aside>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="sl-v70-security-grid">
      <section className="sl-v70-security-main">
        <article className="sl-v70-security-section">
          <header className="sl-v70-section-head">
            <span className="sl-v70-section-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
            <div>
              <h2>Authentication &amp; Access</h2>
              <p>Configure authentication policies and access controls for all users.</p>
            </div>
          </header>

          <div className="sl-v70-field-grid">
            <label>
              <span>Password Policy</span>
              <select defaultValue="strong">
                <option value="strong">Strong (recommended)</option>
              </select>
              <small>Minimum 8 characters, with uppercase, lowercase, number, and special character.</small>
            </label>

            <label>
              <span>Session Timeout</span>
              <select defaultValue="15">
                <option value="15">15 minutes</option>
              </select>
              <small>Automatically logs out inactive users.</small>
            </label>
          </div>

          <div className="sl-v70-switch-grid">
            <SecurityRow title="Require Multi-Factor Authentication (MFA)" description="Require MFA for all users (recommended)." enabled />
            <SecurityRow title="Enforce Account Lockout" description="Lock account after 5 failed login attempts." enabled />
            <SecurityRow title="Allow Remember Me" description="Allow users to stay signed in on trusted devices." />
            <SecurityRow title="Restrict Concurrent Sessions" description="Limit each user to one active session per account." enabled />
          </div>
        </article>

        <article className="sl-v70-security-section">
          <header className="sl-v70-section-head">
            <span className="sl-v70-section-icon"><UserRoundCog size={17} aria-hidden="true" /></span>
            <div>
              <h2>Access Control &amp; Permissions</h2>
              <p>Manage role permissions and access control settings.</p>
            </div>
          </header>

          <div className="sl-v70-field-grid">
            <label>
              <span>Default Role for New Users</span>
              <select defaultValue="inventory">
                <option value="inventory">Inventory Staff</option>
              </select>
              <small>Role assigned when a new user is created.</small>
            </label>

            <div className="sl-v70-inline-control">
              <SecurityRow title="Require Admin Approval for New Users" description="New user accounts require approval before activation." enabled />
            </div>
          </div>

          <div className="sl-v70-switch-grid">
            <SecurityRow title="Allow Role Modification" description="Allow Super Admin to edit user roles." enabled />
            <SecurityRow title="Restrict Self-Promotion" description="Prevent users from changing their own role to a higher privilege level." enabled />
          </div>
        </article>

        <article className="sl-v70-security-section">
          <header className="sl-v70-section-head">
            <span className="sl-v70-section-icon"><KeyRound size={17} aria-hidden="true" /></span>
            <div>
              <h2>Data Protection</h2>
              <p>Configure data security and privacy settings.</p>
            </div>
          </header>

          <div className="sl-v70-switch-grid">
            <SecurityRow title="Encrypt Sensitive Data" description="Encrypt sensitive data (e.g., passwords, tokens, personal information)." enabled />
            <SecurityRow title="Enable Audit Logging" description="Log all sensitive actions and configuration changes." enabled />
          </div>

          <div className="sl-v70-field-grid">
            <label>
              <span>Data Retention Period</span>
              <select defaultValue="2years">
                <option value="2years">2 years</option>
              </select>
              <small>How long to keep audit logs and security records.</small>
            </label>

            <div className="sl-v70-inline-control">
              <SecurityRow title="Mask Personal Information" description="Mask personal data in logs and exports." enabled />
            </div>
          </div>
        </article>

        <footer className="sl-v70-actions">
          <button type="button" className="sl-v70-secondary">Discard Changes</button>
          <button type="button" className="sl-v70-primary">Save Settings</button>
        </footer>
      </section>

      <aside className="sl-v70-security-rail">
        <section className="sl-v70-side-card">
          <header className="sl-v70-side-head">
            <div className="sl-v70-side-head-left">
              <span className="sl-v70-section-icon"><ShieldCheck size={16} aria-hidden="true" /></span>
              <div><h2>Security Status</h2><p>Live security health and risk information.</p></div>
            </div>
            <Status>Data pending</Status>
          </header>
          <DataState
            kind="empty"
            title="Security status unavailable"
            description="Security health metrics will appear here when the backend status source is connected."
          />
        </section>

        <section className="sl-v70-side-card">
          <header className="sl-v70-side-head">
            <div className="sl-v70-side-head-left">
              <span className="sl-v70-section-icon"><LockKeyhole size={16} aria-hidden="true" /></span>
              <div>
                <h2>Security Policies</h2>
              </div>
            </div>
            <span className="sl-v70-linklike">Edit</span>
          </header>

          <dl className="sl-v70-policy-list">
            <div><dt>Password Policy</dt><dd>—</dd></div>
            <div><dt>Session Timeout</dt><dd>—</dd></div>
            <div><dt>MFA Requirement</dt><dd>—</dd></div>
            <div><dt>Account Lockout</dt><dd>—</dd></div>
            <div><dt>Data Retention</dt><dd>—</dd></div>
            <div><dt>Audit Logging</dt><dd>—</dd></div>
            <div><dt>Personal Data Masking</dt><dd>—</dd></div>
          </dl>
        </section>

        <section className="sl-v70-side-card">
          <header className="sl-v70-side-head">
            <div className="sl-v70-side-head-left">
              <span className="sl-v70-section-icon"><Bell size={16} aria-hidden="true" /></span>
              <div><h2>Recent Security Events</h2></div>
            </div>
            <span className="sl-v70-linklike">View all →</span>
          </header>
          <DataState
            kind="empty"
            title="No live records yet"
            description="Security events will appear here when the security-event backend is connected."
          />
        </section>
      </aside>
    </div>
  );
}


const notificationPreferences = [
  {
    label: 'Expiring Ingredients',
    description: 'Notify about ingredients nearing expiration.',
    Icon: AlertTriangle,
    tone: 'critical',
    email: true,
    inApp: true,
    push: true,
  },
  {
    label: 'Low Stock Alerts',
    description: 'Notify when stock falls below the minimum level.',
    Icon: Bell,
    tone: 'attention',
    email: true,
    inApp: true,
    push: true,
  },
  {
    label: 'Waste Records',
    description: 'Notify on recorded waste entries.',
    Icon: Boxes,
    tone: 'brand',
    email: true,
    inApp: true,
    push: false,
  },
  {
    label: 'Change Requests',
    description: 'Notify on new or updated change requests.',
    Icon: ClipboardList,
    tone: 'brand',
    email: true,
    inApp: true,
    push: false,
  },
  {
    label: 'Forecasting Updates',
    description: 'Notify when new forecast results are available.',
    Icon: TrendingUp,
    tone: 'success',
    email: true,
    inApp: true,
    push: false,
  },
  {
    label: 'System Announcements',
    description: 'Notify about system updates and maintenance.',
    Icon: Megaphone,
    tone: 'brand',
    email: true,
    inApp: true,
    push: true,
  },
  {
    label: 'Security Alerts',
    description: 'Notify about suspicious activity and security events.',
    Icon: ShieldCheck,
    tone: 'critical',
    email: true,
    inApp: true,
    push: true,
  },
] as const;

function NotificationPanel() {
  return (
    <div className="sl-v72-notification-grid">
      <section className="sl-v72-notification-main">
        <article className="sl-v72-card sl-v72-channel-settings">
          <header className="sl-v72-section-head">
            <span className="sl-v72-section-icon"><Mail size={17} aria-hidden="true" /></span>
            <div>
              <h2>Notification Settings</h2>
              <p>Configure how system notifications are sent and received across all users.</p>
            </div>
          </header>

          <div className="sl-v72-channel-grid">
            <div className="sl-v72-channel-column">
              <span className="sl-v72-field-label">Email Notifications</span>
              <SecurityRow
                title="Enable email notifications"
                description="Send important alerts and updates via email."
                enabled
              />

              <span className="sl-v72-field-label">In-App Notifications</span>
              <SecurityRow
                title="Enable in-app notifications"
                description="Show notifications inside the application."
                enabled
              />
            </div>

            <div className="sl-v72-channel-column">
              <label>
                <span className="sl-v72-field-label">Notification Sender</span>
                <input readOnly value="noreply@shelflifeai.com" />
                <small>This email will be used for system-generated notifications.</small>
              </label>

              <label>
                <span className="sl-v72-field-label">Default Notification Language</span>
                <select defaultValue="English">
                  <option>English</option>
                </select>
                <small>Language for system notification content.</small>
              </label>
            </div>
          </div>
        </article>

        <article className="sl-v72-card sl-v72-preferences">
          <header className="sl-v72-preference-head">
            <div className="sl-v72-section-head">
              <span className="sl-v72-section-icon"><Bell size={17} aria-hidden="true" /></span>
              <div>
                <h2>Notification Preferences</h2>
                <p>Enable or disable notification types. These settings apply to all users unless overridden at the user level.</p>
              </div>
            </div>
            <button type="button" className="sl-v72-reset-button">Reset to Default</button>
          </header>

          <div className="sl-v72-preference-table-wrap">
            <table className="sl-v72-preference-table">
              <thead>
                <tr>
                  <th scope="col">Notification Type</th>
                  <th scope="col">Email</th>
                  <th scope="col">In-App</th>
                  <th scope="col">Push (Web)</th>
                </tr>
              </thead>
              <tbody>
                {notificationPreferences.map(({ label, description, Icon, tone, email, inApp, push }) => (
                  <tr key={label}>
                    <td>
                      <div className="sl-v72-pref-type">
                        <span className={`sl-v72-pref-icon is-${tone}`}><Icon size={15} aria-hidden="true" /></span>
                        <div>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </div>
                      </div>
                    </td>
                    <td><Toggle defaultChecked={email} /></td>
                    <td><Toggle defaultChecked={inApp} /></td>
                    <td><Toggle defaultChecked={push} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <footer className="sl-v72-save-strip">
          <div className="sl-v72-info-note">
            <span aria-hidden="true">i</span>
            <p>Notification settings may be overridden for individual users in their account settings.</p>
          </div>
          <button type="button" className="sl-v72-save-button">Save Changes</button>
        </footer>
      </section>

      <aside className="sl-v72-notification-rail">
        <section className="sl-v72-card">
          <header className="sl-v72-side-head">
            <div className="sl-v72-side-head-left">
              <span className="sl-v72-section-icon"><Bell size={16} aria-hidden="true" /></span>
              <h2>Notification Channels Status</h2>
            </div>
          </header>

          <ul className="sl-v72-channel-status">
            <li>
              <span className="sl-v72-channel-status-icon"><Mail size={15} aria-hidden="true" /></span>
              <div><strong>Email Service</strong><small>Status source not connected</small></div>
              <Status>Data pending</Status>
            </li>
            <li>
              <span className="sl-v72-channel-status-icon"><MonitorSmartphone size={15} aria-hidden="true" /></span>
              <div><strong>In-App Notifications</strong><small>Status source not connected</small></div>
              <Status>Data pending</Status>
            </li>
            <li>
              <span className="sl-v72-channel-status-icon"><Bell size={15} aria-hidden="true" /></span>
              <div><strong>Push Notifications (Web)</strong><small>Status source not connected</small></div>
              <Status>Data pending</Status>
            </li>
          </ul>
        </section>

        <section className="sl-v72-card sl-v72-preview-card">
          <header className="sl-v72-side-head">
            <div className="sl-v72-side-head-left">
              <span className="sl-v72-section-icon"><MonitorSmartphone size={16} aria-hidden="true" /></span>
              <div>
                <h2>Notification Preview</h2>
                <p>See how notifications look for users.</p>
              </div>
            </div>
          </header>

          <div className="sl-v72-preview-tabs">
            <button type="button" className="is-active">Email</button>
            <button type="button">In-App</button>
            <button type="button">Push (Web)</button>
          </div>

          <div className="sl-v72-email-preview">
            <div className="sl-v72-email-brand">
              <span className="sl-v72-email-mark">S</span>
              <div><strong>ShelfLife AI</strong><small>noreply@shelflifeai.com</small></div>
            </div>
            <strong>Ingredient Expiring Soon</strong>
            <p>Fresh Milk (MILK-001) will expire in 1 day. Please take the necessary action.</p>
            <button type="button">View Details</button>
          </div>
        </section>

        <section className="sl-v72-card">
          <header className="sl-v72-side-head">
            <div className="sl-v72-side-head-left">
              <span className="sl-v72-section-icon"><Bell size={16} aria-hidden="true" /></span>
              <h2>Recent Notifications Sent</h2>
            </div>
            <span className="sl-v72-linklike">View all →</span>
          </header>

          <DataState
            kind="empty"
            title="No live records yet"
            description="Sent notification history will appear here when the notification audit source is connected."
          />
        </section>
      </aside>
    </div>
  );
}





function MaintenancePanel() {
  return (
    <div className="sl-v73-maintenance-grid">
      <section className="sl-v73-maintenance-main">
        <article className="sl-v73-card">
          <header className="sl-v73-section-head">
            <span className="sl-v73-section-icon"><Wrench size={17} aria-hidden="true" /></span>
            <div>
              <h2>Maintenance Mode</h2>
              <p>Temporarily restrict system access for maintenance or major updates.</p>
            </div>
          </header>

          <div className="sl-v73-two-column">
            <div className="sl-v73-stack">
              <SecurityRow
                title="Enable Maintenance Mode"
                description="When enabled, only Super Admin can access the system."
                enabled
              />
            </div>

            <label className="sl-v73-field">
              <span>Maintenance Message</span>
              <textarea readOnly value="ShelfLife AI is currently under maintenance. Please check back later." />
              <small>57/200</small>
            </label>
          </div>
        </article>

        <article className="sl-v73-card">
          <header className="sl-v73-section-head">
            <span className="sl-v73-section-icon"><Database size={17} aria-hidden="true" /></span>
            <div>
              <h2>Database Management</h2>
              <p>Manage database operations such as backups and data retention.</p>
            </div>
          </header>

          <div className="sl-v73-two-column">
            <div className="sl-v73-stack">
              <SecurityRow
                title="Enable automatic backups"
                description="Schedule regular database backups."
                enabled
              />

              <label className="sl-v73-field">
                <span>Backup Frequency</span>
                <select defaultValue="Daily">
                  <option>Daily</option>
                </select>
                <small>How often to create automatic backups.</small>
              </label>
            </div>

            <div className="sl-v73-stack">
              <div className="sl-v73-meta-pair">
                <div>
                  <span className="sl-v73-meta-label">Last Backup</span>
                  <strong>—</strong>
                </div>
                <Status>Data pending</Status>
              </div>

              <div className="sl-v73-meta-block">
                <span className="sl-v73-meta-label">Next Scheduled Backup</span>
                <strong>—</strong>
              </div>

              <button type="button" className="sl-v73-secondary-button">View Backup History</button>
            </div>
          </div>
        </article>

        <article className="sl-v73-card">
          <header className="sl-v73-section-head">
            <span className="sl-v73-section-icon"><RefreshCw size={17} aria-hidden="true" /></span>
            <div>
              <h2>System Updates</h2>
              <p>Manage application updates and version control.</p>
            </div>
          </header>

          <div className="sl-v73-two-column">
            <div className="sl-v73-stack">
              <div className="sl-v73-version-box">
                <span className="sl-v73-meta-label">Current Version</span>
                <div className="sl-v73-version-row">
                  <strong>—</strong>
                  <Status>Data pending</Status>
                </div>
                <small>Version data will appear when the update backend is connected.</small>
              </div>
            </div>

            <div className="sl-v73-stack">
              <SecurityRow
                title="Enable automatic updates"
                description="Automatically install patch updates (recommended)."
                enabled
              />

              <label className="sl-v73-field">
                <span>Update Channel</span>
                <select defaultValue="Stable (Recommended)">
                  <option>Stable (Recommended)</option>
                </select>
                <small>Choose which updates to receive.</small>
              </label>
            </div>
          </div>
        </article>

        <article className="sl-v73-card">
          <header className="sl-v73-section-head">
            <span className="sl-v73-section-icon"><HardDriveDownload size={17} aria-hidden="true" /></span>
            <div>
              <h2>Data Maintenance</h2>
              <p>Manage historical data, logs, and cleanup settings.</p>
            </div>
          </header>

          <div className="sl-v73-two-column">
            <label className="sl-v73-field">
              <span>Log Retention Period</span>
              <select defaultValue="1 year">
                <option>1 year</option>
              </select>
              <small>How long to keep system logs.</small>
            </label>

            <div className="sl-v73-stack">
              <SecurityRow
                title="Enable automatic cleanup"
                description="Permanently delete archived data after the retention period."
              />
            </div>
          </div>
        </article>
      </section>

      <aside className="sl-v73-maintenance-rail">
        <section className="sl-v73-card">
          <header className="sl-v73-side-head">
            <div className="sl-v73-side-head-left">
              <span className="sl-v73-section-icon"><TimerReset size={16} aria-hidden="true" /></span>
              <div><h2>System Health</h2><p>Real-time status of system services.</p></div>
            </div>
            <Status>Data pending</Status>
          </header>
          <DataState
            kind="empty"
            title="System health unavailable"
            description="Service-health data will appear here when the monitoring backend is connected."
          />
        </section>

        <section className="sl-v73-card">
          <header className="sl-v73-side-head">
            <div className="sl-v73-side-head-left">
              <span className="sl-v73-section-icon"><CalendarDays size={16} aria-hidden="true" /></span>
              <div><h2>Maintenance Schedule</h2><p>View upcoming maintenance activities.</p></div>
            </div>
            <span className="sl-v73-linklike">View all →</span>
          </header>
          <DataState
            kind="empty"
            title="No live records yet"
            description="Scheduled maintenance will appear here when the maintenance backend is connected."
          />
        </section>

        <section className="sl-v73-card">
          <header className="sl-v73-side-head">
            <div className="sl-v73-side-head-left">
              <span className="sl-v73-section-icon"><ClipboardList size={16} aria-hidden="true" /></span>
              <div><h2>Recent Maintenance Activity</h2></div>
            </div>
            <span className="sl-v73-linklike">View all →</span>
          </header>
          <DataState
            kind="empty"
            title="No live records yet"
            description="Maintenance activity will appear here when its audit backend is connected."
          />
        </section>
      </aside>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="sl-v70-placeholder-grid">
      <section className="sl-v70-placeholder-card">
        <header className="sl-v70-panel-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </header>
        <DataState
          kind="empty"
          title="Tab UI not connected yet"
          description="This section is ready for the next reference-based UI pass."
        />
      </section>
    </div>
  );
}

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  return (
    <div className="sl-system-settings-v70" data-ui-version="v76-systemwide-placeholders">
      <PageHeader
        eyebrow="System Settings"
        title="System Settings"
        description="Manage the global configuration of ShelfLife AI."
      />

      <nav className="sl-v70-settings-tabs" aria-label="System settings sections">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'general' && <GeneralPanel />}
      {activeTab === 'security' && <SecurityPanel />}
      {activeTab === 'notifications' && <NotificationPanel />}
      {activeTab === 'maintenance' && <MaintenancePanel />}
    </div>
  );
}
