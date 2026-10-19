import { AuditTable } from '../../components/application/AuditTable';
import { PageHeader } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

export default function AdministrativeAudit() {
  const { user } = useApplicationWorkspace();
  const superAdmin = user.role === 'Super Admin';
  // The eyebrow follows the viewer's own navigation group: the Super Admin
  // sidebar files Audit Logs under "Administration", while Admin files it under
  // "Oversight". The removed OVERSIGHT group is never reintroduced for Super Admin.
  return <>
    <PageHeader eyebrow={superAdmin ? 'Administration' : 'Oversight'} title="Audit Logs" description="View and monitor user activities and changes made within your establishment." />
    <div className="sl-admin-view">
      <AuditTable adminOverview includeSuperAdminActors={superAdmin} />
    </div>
  </>;
}
