import { AccountsTable } from './AccountsTable';
import { administrationAreas, type AdministrationAreaId } from './administration';
import { AuditTable } from './AuditTable';
import { Card, DataState, PageHeader, Status, SummaryCards } from './primitives';

export function AdministrationPage({ areaId }: { areaId: AdministrationAreaId }) {
  const area = administrationAreas.find(item => item.id === areaId)!;

  if (areaId === 'accounts') {
    return <>
      <PageHeader eyebrow="Administration" title="User Management" description="System-wide user, role, and account-access oversight." />
      <div className="sl-admin-view sl-superadmin-users-page-v56 sl-superadmin-users-page-v57 sl-superadmin-users-page-v58 sl-superadmin-users-page-v59 sl-superadmin-users-page-v60 sl-superadmin-users-page-v61 sl-superadmin-users-page-v62 sl-superadmin-users-page-v63 sl-superadmin-users-page-v64">
        <AccountsTable />
      </div>
    </>;
  }

  if (areaId === 'security') {
    return <>
      <PageHeader eyebrow="Security & Activity" title={area.label} description="Read-only records of administrative account changes." />
      <div className="sl-admin-view">
        <SummaryCards items={[
          { label: 'Administrative audit', value: 'Connected', detail: 'Successful account changes', tone: 'success' },
          { label: 'Sign-in activity', value: '—', detail: 'Awaiting authentication-event service', tone: 'brand' },
          { label: 'Session activity', value: '—', detail: 'Awaiting session-event service', tone: 'attention' },
          { label: 'Security alerts', value: '—', detail: 'Awaiting monitoring service', tone: 'critical' },
        ]} />
        <div className="sl-module-columns">
          <Card id="sl-audit-records" title="Administrative audit records"><AuditTable /></Card>
          <Card id="security-scope" title="Security coverage">
            <dl className="sl-guidance-list">
              <div><dt>Account changes</dt><dd>Successful create, update, deactivate, and reactivate actions are recorded automatically.</dd></div>
              <div><dt>Authentication activity</dt><dd><Status>Not connected</Status></dd><dd>Sign-in and persistent-session history will appear when its event service is connected.</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </>;
  }

  return <>
    <PageHeader eyebrow="System Settings" title="System Settings" description="Manage the global configuration of ShelfLife AI." />
    <div className="sl-admin-view sl-superadmin-settings-v65">
      <nav className="sl-v65-settings-tabs" aria-label="System Settings sections">
        <button type="button" className="is-active">General</button>
        <button type="button">Security</button>
        <button type="button">Notifications</button>
        <button type="button">Inventory &amp; Expiry</button>
        <button type="button">Forecasting</button>
        <button type="button">Integrations</button>
        <button type="button">System Maintenance</button>
      </nav>

      <div className="sl-v65-settings-layout">
        <section className="sl-v65-settings-main" aria-labelledby="sl-v65-general-title">
          <div className="sl-v65-section-head">
            <div>
              <h2 id="sl-v65-general-title">General Settings</h2>
              <p>Configure basic system information and preferences.</p>
            </div>
          </div>

          <div className="sl-v65-settings-form" aria-label="General system settings preview">
            <label><span>System Name</span><input value="" placeholder="Configuration data pending" readOnly /></label>
            <label><span>System Tagline</span><input value="" placeholder="Configuration data pending" readOnly /></label>

            <label className="sl-v65-field-wide"><span>System Description</span><textarea value="" placeholder="Configuration data pending" readOnly /></label>

            <label><span>Time Zone</span><select value="" disabled><option value="">Configuration data pending</option></select></label>
            <label><span>Date Format</span><select value="" disabled><option value="">Configuration data pending</option></select></label>
            <label><span>Default Language</span><select value="" disabled><option value="">Configuration data pending</option></select></label>
            <label><span>Currency</span><select value="" disabled><option value="">Configuration data pending</option></select></label>

            <div className="sl-v65-field-wide sl-v65-logo-field">
              <span className="sl-v65-field-label">System Logo</span>
              <div className="sl-v65-logo-row">
                <div className="sl-v65-logo-preview">
                  <strong>ShelfLife AI</strong>
                  <small>System logo preview</small>
                </div>
                <div className="sl-v65-logo-actions">
                  <button type="button" disabled>Change Logo</button>
                  <button type="button" disabled>Remove</button>
                  <small>Configuration service required before logo changes can be saved.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="sl-v65-save-row">
            <span>Settings are read-only until the configuration API is connected.</span>
            <button type="button" className="sl-save-changes-ui" disabled>Save Changes</button>
          </div>
        </section>

        <aside className="sl-v65-settings-side" aria-label="System settings information">
          <section className="sl-v65-side-card">
            <div className="sl-v65-side-title"><h2>System Information</h2><span aria-hidden="true">✎</span></div>
            <dl className="sl-v65-info-list">
              <div><dt>Application Version</dt><dd>—</dd></div>
              <div><dt>Environment</dt><dd><Status>Data pending</Status></dd></div>
              <div><dt>Last Updated</dt><dd>—</dd></div>
              <div><dt>Updated By</dt><dd>—</dd></div>
              <div><dt>Deployment Status</dt><dd><Status>Data pending</Status></dd></div>
            </dl>
          </section>

          <section className="sl-v65-side-card">
            <div className="sl-v65-side-title"><h2>System Services</h2><span>View details →</span></div>
            <ul className="sl-v65-service-list">
              {['Web Application', 'API Server', 'Database (MongoDB Atlas)', 'File Storage (Cloudinary)', 'Email Service', 'AI Forecasting Service'].map(service =>
                <li key={service}><span className="sl-v65-service-icon">◆</span><span>{service}</span><Status>Data pending</Status></li>
              )}
            </ul>
          </section>

          <section className="sl-v65-side-card">
            <div className="sl-v65-side-title"><h2>Recent Configuration Changes</h2><span>View all →</span></div>
            <DataState kind="empty" title="No live records yet" description="Configuration activity will appear here when its audit source is connected." />
          </section>
        </aside>
      </div>
    </div>
  </>;
}