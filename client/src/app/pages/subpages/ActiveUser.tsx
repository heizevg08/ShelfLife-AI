import { Redirect } from 'expo-router';
import { useApplicationWorkspace } from '../../../components/application/ApplicationWorkspace';
export default function LegacyAccounts() { const { user } = useApplicationWorkspace(); return <Redirect href={'/UserManagement'} />; }
