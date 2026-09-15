import { AccountsTable } from './AccountsTable';
import { administrationAreas, type AdministrationAreaId } from './administration';
import { AuditTable } from './AuditTable';
import { Card, DataState, PageHeader, Status, SummaryCards } from './primitives';

export function AdministrationPage({ areaId }: { areaId: AdministrationAreaId }) {
  const area = administrationAreas.find(item => item.id === areaId)!;

  if (areaId === 'accounts') {
    return <>
      <PageHeader eyebrow="Administration" title={area.label} description="Manage Admin, Manager, and Inventory Staff accounts." />
      <div className="sl-admin-view">
        <SummaryCards items={[
          { label: 'Account directory', value: 'Connected', detail: 'MongoDB account records', tone: 'success' },
          { label: 'Managed roles', value: '3', detail: 'Admin · Manager · Inventory Staff', tone: 'brand' },
          { label: 'Lifecycle', value: 'Available', detail: 'Create · update · deactivate · reactivate', tone: 'success' },
          { label: 'Data updates', value: 'Automatic', detail: 'Directory refreshes in the background', tone: 'brand' },
        ]} />
        <Card id="sl-account-directory" title="Account directory"><AccountsTable /></Card>
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
    <PageHeader eyebrow="Administration" title={area.label} description="System-wide configuration." />
    <div className="sl-admin-view">
      {/* TODO: Replace these setup-state summaries with configuration API values when the backend contract exists. */}
      <SummaryCards items={[
        { label: 'Configuration groups', value: '—', detail: 'Awaiting configuration service', tone: 'brand' },
        { label: 'Active policies', value: '—', detail: 'Awaiting configuration service', tone: 'success' },
        { label: 'Pending review', value: '—', detail: 'Awaiting configuration service', tone: 'attention' },
        { label: 'Policy alerts', value: '—', detail: 'Awaiting configuration service', tone: 'critical' },
      ]} />
      <section className="sl-settings-grid" aria-label="System configuration areas">
        {[
          ['Session policy', 'Authentication and persistent-session policy controls.'],
          ['Notification delivery', 'Notification-channel and delivery configuration.'],
          ['Inventory rules', 'System-wide inventory and expiry rule configuration.'],
        ].map(([title, description]) => <article className="sl-settings-tile" key={title}><Status>Setup required</Status><h2 className="sl-card-title">{title}</h2><p className="sl-supporting">{description}</p></article>)}
      </section>
      <Card id="sl-settings-scope" title="Configuration workspace">
        <DataState kind="unavailable" title="Configuration service not connected" description="Permission-controlled settings will appear here when the backend configuration service is available." />
      </Card>
    </div>
  </>;
}