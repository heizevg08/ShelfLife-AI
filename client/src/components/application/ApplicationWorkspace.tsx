import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from '../../services/auth';
import type { AdministrationAreaId } from './administration';
import ApplicationShell from './ApplicationShell';

const WorkspaceContext = createContext<{ user: SessionUser; openArea: (id: AdministrationAreaId) => void; signOut: (trigger?: HTMLButtonElement | null) => void; refreshIdentity: () => void } | null>(null);

export function ApplicationWorkspace({ children }: { children: ReactNode }) {
  // The route layout retains verified identity across navigation, never across a page reload.
  return <ApplicationShell>{(user, openArea, signOut, refreshIdentity) => <WorkspaceContext.Provider value={{ user, openArea, signOut, refreshIdentity }}>{children}</WorkspaceContext.Provider>}</ApplicationShell>;
}

export function useApplicationWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('Application workspace is required');
  return workspace;
}

export function useOptionalWorkspace() {
  return useContext(WorkspaceContext);
}
