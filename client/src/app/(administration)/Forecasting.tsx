import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage, SuperAdminForecastingPage } from '../../components/application/ModulePage';

export default function Page() {
  const { user } = useApplicationWorkspace();

  // Keep the shared route for every existing role, but bind Super Admin
  // explicitly to its single Forecasting UI owner.
  if (user.role === 'Super Admin') return <SuperAdminForecastingPage />;

  return <ModulePage moduleId="Forecasting" />;
}
