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
  Info,
  CheckCircle2,
  ClipboardList,
  Database,
  EyeOff,
  Globe2,
  HardDriveDownload,
  KeyRound,
  LockKeyhole,
  Mail,
  Megaphone,
  RefreshCw,
  RotateCcw,
  MonitorSmartphone,
  ShieldCheck,
  Settings,
  TimerReset,
  TrendingUp,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';



const securityStatusItems = [
  'MFA Enforced',
  'Account Lockout Enabled',
  'Audit Logging Active',
  'Sensitive Data Encrypted',
  'Session Management Enabled',
];


function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      className={`sl-v70-toggle ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      title="Change is local until a settings backend is connected"
      onClick={() => setChecked(value => !value)}
    >
      <span />
    </button>
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
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const handleSaveChanges = () => {
    setSaveToastVisible(true);
    window.setTimeout(() => setSaveToastVisible(false), 3200);
  };

  return (
    <div className="sl-v66-settings-grid">
      <section className="sl-v66-settings-panel" aria-labelledby="sl-v66-general-settings">
        <header className="sl-v66-panel-heading">
          <div className="sl-v303-section-title"><span className="sl-v303-section-icon"><Settings size={17} aria-hidden="true" /></span><div><h2 id="sl-v66-general-settings">General Settings</h2>
          <p>Configure basic system information and preferences.</p></div></div>
        </header>

        <div className="sl-v66-form-grid">
          <label>
            <span>System name</span>
            <input defaultValue="" placeholder="Configuration data pending" readOnly />
          </label>

          <label>
            <span>System tagline</span>
            <input defaultValue="" placeholder="Configuration data pending" readOnly />
          </label>

          <label className="sl-v66-wide">
            <span>System description</span>
            <textarea defaultValue="" placeholder="Configuration data pending" readOnly />
            <small>Configuration service required before this field can be edited.</small>
          </label>

          <label>
            <span>Time zone</span>
            <select defaultValue="asia-manila" aria-label="Time Zone"><option value="asia-manila">(GMT+8) Asia/Manila</option></select>
          </label>

          <label>
            <span>Date format</span>
            <select defaultValue="mmddyy" aria-label="Date Format"><option value="mmddyy">MM/DD/YY (e.g. Sep 20, 2026)</option><option value="iso8601">ISO 8601 (YYYY-MM-DD)</option></select>
          </label>

          <label>
            <span>Default language</span>
            <select defaultValue="english" aria-label="Default Language"><option value="english">English</option></select>
          </label>

          <label>
            <span>Currency</span>
            <select defaultValue="php" aria-label="Currency"><option value="php">PHP (₱) — Philippine peso</option></select>
          </label>

        </div>

        <div className="sl-settings-general-embedded">
          <SecurityPanel embedded />
          <NotificationPanel embedded />
        </div>

        <footer className="sl-v66-save-row sl-settings-single-save-row">
          <div className="sl-settings-notification-note" role="note">
            <Info size={16} aria-hidden="true" />
            <span>Notification settings may be overridden for individual users in their account settings.</span>
          </div>
          <button type="button" className="sl-button sl-button-primary sl-v56-add-user sl-settings-save-changes sl-save-changes-ui" onClick={handleSaveChanges} title="Configuration services are not fully connected yet">Save Changes</button>
          {saveToastVisible && <div className="sl-system-settings-save-toast" role="status" aria-live="polite"><CheckCircle2 size={17} aria-hidden="true" /><span>Changes prepared. Saving requires the connected configuration services.</span></div>}
        </footer>
      </section>


    </div>
  );
}

function SecurityPanel({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div className={`sl-v70-security-grid ${embedded ? 'is-embedded' : ''}`}>
      <section className="sl-v70-security-main">
        <article className="sl-v70-security-section">
          <header className="sl-v70-section-head">
            <span className="sl-v70-section-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
            <div>
              <h2>Authentication and Access</h2>
              <p>Configure authentication policies and access controls for all users.</p>
            </div>
          </header>

          <div className="sl-v70-switch-grid">
            <SecurityRow title="Require Multi-Factor Authentication (MFA)" description="Require MFA for all users (recommended)." enabled />
            <SecurityRow title="Enforce Account Lockout" description="Lock account after 5 failed login attempts." enabled />
            <SecurityRow title="Allow Remember Me" description="Allow users to stay signed in on trusted devices." />
            <SecurityRow title="Restrict Concurrent Sessions" description="Limit each user to one active session per account." enabled />
          </div>
        </article>


      </section>


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
    push: true,
  },
  {
    label: 'Low Stock Alerts',
    description: 'Notify when stock falls below the minimum level.',
    Icon: Bell,
    tone: 'attention',
    email: true,
    push: true,
  },
  {
    label: 'Waste Records',
    description: 'Notify on recorded waste entries.',
    Icon: Boxes,
    tone: 'brand',
    email: true,
    push: false,
  },
  {
    label: 'Change Requests',
    description: 'Notify on new or updated change requests.',
    Icon: ClipboardList,
    tone: 'brand',
    email: true,
    push: false,
  },
  {
    label: 'Forecasting Updates',
    description: 'Notify when new forecast results are available.',
    Icon: TrendingUp,
    tone: 'success',
    email: true,
    push: false,
  },
  {
    label: 'System Announcements',
    description: 'Notify about system updates and maintenance.',
    Icon: Megaphone,
    tone: 'brand',
    email: true,
    push: true,
  },
  {
    label: 'Security Alerts',
    description: 'Notify about suspicious activity and security events.',
    Icon: ShieldCheck,
    tone: 'critical',
    email: true,
    push: true,
  },
] as const;

function NotificationPanel({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div className={`sl-v72-notification-grid ${embedded ? 'is-embedded' : ''}`}>
      <section className="sl-v72-notification-main">
        <article className="sl-v72-card sl-v72-preferences">
          <header className="sl-v72-preference-head">
            <div className="sl-v72-section-head">
              <span className="sl-v72-section-icon"><Bell size={17} aria-hidden="true" /></span>
              <div>
                <h2>Notifications Preferences</h2>
                <p>Enable or disable notification types. These settings apply to all users unless overridden at the user level.</p>
              </div>
            </div>
            <button type="button" className="sl-v72-reset-button"><RotateCcw size={15} aria-hidden="true" /><span>Reset to default</span></button>
          </header>
          <div className="sl-v72-preference-table-wrap">
            <table className="sl-v72-preference-table">
              <thead><tr><th scope="col">Notification Type</th><th scope="col">Email</th><th scope="col">Push (Web)</th></tr></thead>
              <tbody>{notificationPreferences.map(({ label, description, Icon, tone, email, push }) => (
                <tr key={label}>
                  <td><div className="sl-v72-pref-type"><span className={`sl-v72-pref-icon is-${tone}`}><Icon size={15} aria-hidden="true" /></span><div><strong>{label}</strong><small>{description}</small></div></div></td>
                  <td><Toggle defaultChecked={email} /></td><td><Toggle defaultChecked={push} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </article>
      </section>
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

          <div className="sl-v73-maintenance-flow">
            <SecurityRow
              title="Enable Maintenance Mode"
              description="When enabled, only Super Admin can access the system."
              enabled
            />

            <label className="sl-v73-field">
              <span>Maintenance Message</span>
              <textarea defaultValue="ShelfLife AI is currently under maintenance. Please check back later." />
              <small>57/200</small>
            </label>

            <div className="sl-v73-maintenance-save-row">
              <button type="button" className="sl-settings-save-changes sl-save-changes-ui">Save Changes</button>
            </div>
          </div>
        </article>

        <div className="sl-v73-maintenance-kpis">
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
            <span className="sl-v73-linklike">View all <span aria-hidden="true">→</span></span>
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
            <span className="sl-v73-linklike">View all <span aria-hidden="true">→</span></span>
          </header>
          <DataState
            kind="empty"
            title="No live records yet"
            description="Maintenance activity will appear here when its audit backend is connected."
          />
        </section>
        </div>
      </section>
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
  return (
    <div className="sl-system-settings-v70" data-ui-version="v305-consistent-system-settings">
      <PageHeader
        eyebrow="System Settings"
        title="System Settings"
        description="Manage the global configuration of ShelfLife AI."
      />
      <GeneralPanel />
    </div>
  );
}
