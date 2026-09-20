import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import Dashboard from '../../components/dashboard/SuperAdminDashboard';

export default function SuperAdminDashboard() {
  const { user } = useApplicationWorkspace();
  return <Dashboard user={user} />;
}
