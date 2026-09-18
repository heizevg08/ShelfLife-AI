import { AuditTable } from '../../components/application/AuditTable';
import { PageHeader } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

export default function AdministrativeAudit() {
  const { user } = useApplicationWorkspace();
  return <>
    <PageHeader eyebrow="Security & Activity" title="Audit Logs" description="View and monitor user activities and changes made within your establishment." />
    <div className="sl-admin-view">
      <AuditTable adminOverview={user.role === 'Admin'} />
    </div>
  </>;
}
