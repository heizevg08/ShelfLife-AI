import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from '../../services/auth';
import type { AdministrationAreaId } from './administration';
import ApplicationShell from './ApplicationShell';

const WorkspaceContext = createContext<{ user: SessionUser; openArea: (id: AdministrationAreaId) => void } | null>(null);

export function ApplicationWorkspace({ children }: { children: ReactNode }) {
  // The route layout retains verified identity across navigation, never across a page reload.
  return <ApplicationShell>{(user, openArea) => <WorkspaceContext.Provider value={{ user, openArea }}>{children}</WorkspaceContext.Provider>}</ApplicationShell>;
}

export function useOptionalWorkspace() { return useContext(WorkspaceContext); }

export function useApplicationWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('Application workspace is required');
  return workspace;
}
