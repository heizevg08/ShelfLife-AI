import { Slot } from 'expo-router';
import { ApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

export default function AdministrationLayout() {
  return <ApplicationWorkspace><Slot /></ApplicationWorkspace>;
}
