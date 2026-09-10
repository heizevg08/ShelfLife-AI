import { administrationAreas, type AdministrationAreaId } from './administration';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Card, DashboardGrid, DataState, PageHeader, SummaryItems, UnavailableTable } from './primitives';

export function AdministrationPage({ areaId }: { areaId: AdministrationAreaId }) {
  const area = administrationAreas.find(item => item.id === areaId)!;
  const { user, openArea } = useApplicationWorkspace();
  return <>
    <PageHeader eyebrow="Administration" title={area.label} description={area.summary} />
    {areaId === 'accounts' ? <>
      <Card id="sl-account-totals" title="Administrator account overview">
        <SummaryItems items={[{ label: 'All Admin accounts' }, { label: 'Active Admin accounts' }, { label: 'Disabled Admin accounts' }]} />
      </Card>
      <Card id="sl-account-directory" title="Admin-account directory">
        <UnavailableTable label="Admin-account directory" columns={['Name', 'Email', 'Role', 'Account status']}
          description="Account status shows whether an account is enabled, not whether someone is online." />
      </Card>
      <Card id="sl-account-controls" title="Account administration">
        <DataState title="Account management unavailable" description="Admin accounts cannot be created or changed here yet." />
      </Card>
    </> : areaId === 'security' ? <>
      <DashboardGrid>
        <Card id="sl-current-account" title="Your authenticated account">
          <SummaryItems items={[{ label: 'Name', value: user.name }, { label: 'Email', value: user.email }, { label: 'Account status', value: user.isActive ? 'Active' : 'Inactive' }]} />
          <p className="sl-section-note sl-supporting">These details describe your account only.</p>
        </Card>
        <Card id="sl-security-monitoring" title="Security monitoring">
          <SummaryItems items={[{ label: 'Security events' }, { label: 'Active-session monitoring' }]} />
          <p className="sl-section-note sl-supporting">Security history is unavailable; this does not confirm an absence of incidents.</p>
        </Card>
      </DashboardGrid>
      <Card id="sl-audit-records" title="Protected audit records">
        <UnavailableTable label="Protected audit records" columns={['Timestamp', 'Actor', 'Action', 'Resource type', 'Resource ID']}
          description="System-generated records of administrative actions. Audit records cannot be edited here." />
      </Card>
    </> : <>
      <Card id="sl-settings-scope" title="System-wide configuration">
        <UnavailableTable label="System configuration" columns={['Setting', 'Current value']}
          description="System-wide settings for ShelfLife AI." />
      </Card>
      <DashboardGrid>
        <Card id="sl-settings-changes" title="Configuration changes">
          <DataState title="Editing unavailable" description="System settings cannot be changed here yet." />
        </Card>
        <Card id="sl-settings-related" title="Related administration">
          <div className="sl-related-actions">
            <button className="sl-button" onClick={() => openArea('accounts')}>Open Admin Accounts</button>
            <button className="sl-button" onClick={() => openArea('security')}>Open Security & Activity</button>
          </div>
        </Card>
      </DashboardGrid>
    </>}
  </>;
}
