import { Link as RouterLink, useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, type AnchorHTMLAttributes } from 'react';
import { useOptionalWorkspace } from '../components/application/ApplicationWorkspace';
import { canOpenWorkspacePath } from '../components/application/workspace';

/** App route target accepted by navigation links. */
export type Href = string;
type Destination = string | { pathname: string; params?: Record<string, string> };

/** @returns Current pathname without search parameters or hash. */
export function usePathname() { return useLocation({ select: location => location.pathname }); }

/**
 * Keep route changes and URL parameter updates behind one navigation interface.
 * @returns Push, replace, parameter, and hash helpers.
 */
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

/**
 * Read the current query after subscribing to router location changes.
 * @returns Parsed query values; callers provide the expected key shape.
 */
export function useLocalSearchParams<T extends Record<string, string | undefined>>() {
  useLocation({ select: location => location.href });
  return Object.fromEntries(new URLSearchParams(window.location.search)) as T;
}

/**
 * Hide workspace links that the signed-in role cannot open.
 * @param href - Destination checked against workspace permissions.
 * @param props - Remaining anchor attributes passed to the router link.
 * @returns Authorized link, or `null` when the route is unavailable.
 */
export function Link({ href, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: Href }) {
  const workspace = useOptionalWorkspace();
  if (workspace && !canOpenWorkspacePath(workspace.user.role, href.split(/[?#]/, 1)[0])) return null;
  return <RouterLink to={href} {...props} />;
}
