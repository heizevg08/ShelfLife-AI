import { Slot, usePathname } from 'expo-router';
import { ApplicationWorkspace, useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ConnectedManagerChangeRequestsPage } from '../../components/application/ManagerChangeRequestsPage';

function AdministrationRoute() {
  const pathname = usePathname();
  const { user } = useApplicationWorkspace();

  if (user.role === 'Manager' && pathname === '/ChangeRequests') {
    return <ConnectedManagerChangeRequestsPage />;
  }

  return <Slot />;
}

export default function AdministrationLayout() {
  return <ApplicationWorkspace><AdministrationRoute /></ApplicationWorkspace>;
}
