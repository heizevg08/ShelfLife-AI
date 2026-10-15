import { AdministrationPage } from '../../components/application/AdministrationPage';
import { ModulePage } from '../../components/application/ModulePage';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

export default function Page() {
  const { user } = useApplicationWorkspace();
  return user.role === 'Super Admin' ? <AdministrationPage areaId="accounts" /> : <ModulePage moduleId="UserManagement" />;
}
