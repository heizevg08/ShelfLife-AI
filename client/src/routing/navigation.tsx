import { Link as RouterLink, useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, type AnchorHTMLAttributes } from 'react';
import { useOptionalWorkspace } from '../components/application/ApplicationWorkspace';
import { canOpenWorkspacePath } from '../components/application/workspace';

export type Href = string;
export function usePathname() { return useLocation({ select: location => location.pathname }); }
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (to: string) => void navigate({ to }),
    replace: (to: string) => void navigate({ to, replace: true }),
    clearHash: () => navigate({ hash: '', replace: true }),
  }), [navigate]);
}
// Apply the same permission policy to dashboard cards and tabs as the sidebar.
export function Link({ href, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }) {
  const workspace = useOptionalWorkspace();
  if (workspace && !canOpenWorkspacePath(workspace.user.role, href)) return null;
  return <RouterLink to={href} {...props} />;
}
