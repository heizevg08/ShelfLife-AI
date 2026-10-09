import { Link as RouterLink, useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, type AnchorHTMLAttributes } from 'react';
import { useOptionalWorkspace } from '../components/application/ApplicationWorkspace';
import { canOpenWorkspacePath } from '../components/application/workspace';

export type Href = string;
type Destination = string | { pathname: string; params?: Record<string, string> };

export function usePathname() { return useLocation({ select: location => location.pathname }); }

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => {
    const go = (destination: Destination, replace = false) => {
      if (typeof destination === 'string') return void navigate({ to: destination, replace } as never);
      return void navigate({ to: destination.pathname, search: destination.params ?? {}, replace } as never);
    };
    return {
      push: (destination: Destination) => go(destination),
      replace: (destination: Destination) => go(destination, true),
      setParams: (params: Record<string, string>) => {
        if ('#' in params) return void navigate({ hash: params['#'], replace: true } as never);
        return void navigate({ search: (previous: Record<string, unknown>) => ({ ...previous, ...params }), replace: true } as never);
      },
      clearHash: () => void navigate({ hash: '', replace: true } as never),
    };
  }, [navigate]);
}

export function useLocalSearchParams<T extends Record<string, string | undefined>>() {
  useLocation({ select: location => location.href });
  return Object.fromEntries(new URLSearchParams(window.location.search)) as T;
}

export function Link({ href, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: Href }) {
  const workspace = useOptionalWorkspace();
  if (workspace && !canOpenWorkspacePath(workspace.user.role, href)) return null;
  return <RouterLink to={href} {...props} />;
}
