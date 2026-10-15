import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage, SuperAdminExpirationMonitoringPage } from '../../components/application/ModulePage';

export default function Page() {
  const { user } = useApplicationWorkspace();

  // Keep the shared route for every existing role, but bind Super Admin
  // explicitly to its single Expiration Monitoring UI owner.
  if (user.role === 'Super Admin') return <SuperAdminExpirationMonitoringPage />;

  return <ModulePage moduleId="ExpirationMonitoring" />;
}
