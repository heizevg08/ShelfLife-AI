import { usePathname, useRouter, type Href } from 'expo-router';
import {
  ArrowUp,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthRequestError, currentUser, logout as endSession, sessionDisplayName, sessionInitials, type SessionUser } from '../../services/auth';
import { getSystemAvailability } from '../../services/system';
import '../../styles/application.css';
import { Brand } from './Brand';
import { Dialog } from './Dialog';
import { Notifications } from './Notifications';
import { administrationAreas, type AdministrationAreaId } from './administration';
import { DataState } from './primitives';
import { useHoverIntent } from './useHoverIntent';

import { canOpenWorkspacePath, dashboardPaths, workspaceNavigation } from './workspace';

export default function ApplicationShell({ children }: { children: (user: SessionUser, openArea: (id: AdministrationAreaId) => void) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [systemHealth, setSystemHealth] = useState<'checking' | 'healthy' | 'attention' | 'unavailable'>('checking');
  const [topbarClock, setTopbarClock] = useState(() => new Date());
  const appRef = useRef<HTMLDivElement>(null);
  const dashboardPath = dashboardPaths[user?.role ?? 'Super Admin'];
  const destinations = [{ label: 'Dashboard', Icon: LayoutDashboard, path: dashboardPath }, ...(user?.role === 'Super Admin' ? administrationAreas.filter(area => !('hidden' in area && area.hidden)) : user ? workspaceNavigation(user.role) : [])];
  const superAdminSearchEntries = user?.role === 'Super Admin' ? [
    { label: 'User Accounts', path: '/UserManagement', Icon: Search, keywords: 'users accounts admin manager inventory staff create add user roles active deactivated' },
    { label: 'Alert Queue', path: '/Alerts', Icon: Search, keywords: 'alerts critical low stock expiring expiration waste risk severity status' },
    { label: 'Change Request Queue', path: '/ChangeRequests', Icon: Search, keywords: 'requests pending approved rejected threshold override discard batch reorder level review' },
    { label: 'Recent Audit Logs', path: '/AdministrativeAudit', Icon: Search, keywords: 'audit logs actor action account created updated deactivated reactivated security activity' },
    { label: 'Waste & Forecast Reports', path: '/Reports', Icon: Search, keywords: 'reports weekly waste cost forecast accuracy predicted actual waste inventory value analytics high waste' },
    { label: 'System Configuration', path: '/SystemSettings', Icon: Search, keywords: 'settings configuration session policy notifications inventory rules policies' },
  ] : [];
  const searchIndex = [...destinations.map(item => ({ ...item, keywords: item.label })), ...superAdminSearchEntries];
  const searchMatches = searchQuery.trim()
    ? searchIndex.filter(item => item.path && `${item.label} ${item.keywords}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).filter((item, index, all) => all.findIndex(candidate => candidate.label === item.label && candidate.path === item.path) === index).slice(0, 8)
    : [];
  const navigationGroups = destinations.reduce<{ label: string; items: typeof destinations }[]>((groups, item) => {
    const group = !user || item.path === dashboardPath ? 'Overview'
      : user.role === 'Super Admin' ? (['/UserManagement', '/SystemSettings', '/SecurityActivity'].includes(item.path ?? '') ? 'Administration' : 'System Oversight')
      : user.role === 'Admin' ? (item.path === '/UserManagement' ? 'User management' : ['/Ingredients', '/InventoryBatches'].includes(item.path) ? 'Core data' : 'Oversight')
      : user.role === 'Manager' ? (['/InventoryBatches', '/Inventory'].includes(item.path ?? '') ? 'Inventory' : ['/UsageWaste', '/ChangeRequests'].includes(item.path) ? 'Operations' : 'Intelligence')
      : ['/InventoryBatches', '/StockIn'].includes(item.path) ? 'Inventory' : ['/Usage', '/UsageRecording', '/Waste', '/WasteRecording'].includes(item.path) ? 'Records' : 'Follow-up';
    const existing = groups.find(entry => entry.label === group);
    if (existing) existing.items.push(item);
    else groups.push({ label: group, items: [item] });
    return groups;
  }, []);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const railCollapsed = collapsed && !hoverExpanded;
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const loggingOut = useRef(false);
  const logoutButton = useRef<HTMLButtonElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [focusedNavigation, setFocusedNavigation] = useState<{ label: string; top: number } | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTopbarClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const isDashboardRoute = user ? Object.values(dashboardPaths).some(path => path === pathname) : false;
  const topbarDateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(topbarClock);

  useEffect(() => {
    // Resolve identity through the existing auth boundary, never from cached role data.
    let active = true;
    // Recheck on route changes without replacing an already resolved workspace with a loading page.
    setLoading(!user);
    setFailed(false);
    currentUser()
      .then(value => {
        if (active) setUser(value);
      })
      .catch(error => {
        if (!active) return;
        if (error instanceof AuthRequestError && error.status === 401) { setUser(null); router.replace('/ShelfLifeAILogin'); }
        else setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, router, pathname]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('shelflifeai.sidebar.collapsed') === 'true');
    } catch {
      /* Preference storage is optional */
    }
  }, []);

  useEffect(() => {
    // Administration workspaces enter in the same collapsed rail state after login.
    // The rail can still expand temporarily on hover or persistently from the toggle button.
    if (user?.role === 'Admin' || user?.role === 'Super Admin') {
      sidebarHover.cancel();
      setHoverExpanded(false);
      setCollapsed(true);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!accountOpen || confirmLogout) return;
    const outside = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen, confirmLogout]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 769px)');
    const closeOnDesktop = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await getSystemAvailability(controller.signal);
        if (active) setSystemHealth(result.backendAlive && result.backendReady ? 'healthy' : 'attention');
      } catch {
        if (active && !controller.signal.aborted) setSystemHealth('unavailable');
      }
    };

    check();
    const interval = window.setInterval(check, 30000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  const changeNotifications = useCallback((open: boolean) => {
    setNotificationsOpen(open);
    if (open) setAccountOpen(false);
  }, []);



  const openArea = (id: AdministrationAreaId) => {
    drawer.current?.close();
    const area = administrationAreas.find(item => item.id === id);
    if (area) router.push(area.path);
  };

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setLogoutPending(true); setLogoutError(false);
    try {
      await endSession();
      setUser(null); setAccountOpen(false);
      router.replace('/ShelfLifeAILogin');
    } catch { setLogoutError(true); }
    finally { loggingOut.current = false; setLogoutPending(false); }
  }, [router]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    sidebarHover.cancel();
    setHoverExpanded(false);
    setCollapsed(next);
    try {
      localStorage.setItem('shelflifeai.sidebar.collapsed', String(next));
    } catch {
      /* Preference storage is optional */
    }
  };

  const sidebarHover = useHoverIntent(() => { if (collapsed) setHoverExpanded(true); }, () => setHoverExpanded(false));
  const accountHover = useHoverIntent(() => { if (!confirmLogout) { setAccountOpen(true); setNotificationsOpen(false); } }, () => { if (!confirmLogout) setAccountOpen(false); });

  function renderNavigation(mobile = false) {
    return (
      <nav aria-label={mobile ? 'Workspace mobile navigation' : 'Workspace navigation'} className="sl-navigation">
        {navigationGroups.map(group => <section className="sl-nav-group" key={group.label} aria-label={group.label}>
          <p className={`sl-eyebrow sl-nav-group-label${mobile ? '' : ' sl-desktop-label'}`}>{group.label}</p>
          {group.items.map(({ label, Icon, path }) =>
          path ? (
            <a
              key={label}
              href={path}
              className="sl-nav-item"
              aria-current={pathname === path || (path === '/UsageWaste' && ['/Usage', '/Waste'].includes(pathname)) || (path === '/InventoryBatches' && pathname === '/ExpirationMonitoring') ? 'page' : undefined}
              aria-label={label}
              title={!mobile && railCollapsed ? label : undefined}
              onFocus={event => !mobile && railCollapsed && setFocusedNavigation({ label, top: event.currentTarget.getBoundingClientRect().top })}
              onBlur={() => setFocusedNavigation(null)}
              onKeyDown={event => { if (event.key === 'Escape') setFocusedNavigation(null); }}
              onClick={event => {
                event.preventDefault();
                drawer.current?.close();
                router.push(path as Href);
              }}
            >
              <Icon size={20} aria-hidden="true" className="sl-nav-icon" />
              <span className={mobile ? 'sl-nav-label' : 'sl-nav-label sl-desktop-label'}>{label}</span>
            </a>
          ) : null
          )}
        </section>)}
      </nav>
    );
  }

  if (loading || (!user && !failed)) {
    // Never render protected identity or dashboard data while the server verifies the session.
    return <div className="sl-app sl-session-pending">
      <main className="sl-session-progress" role="status" aria-label="Loading workspace" aria-busy="true">
        <LoaderCircle className="sl-spin" size={18} aria-hidden="true" />
      </main>
    </div>;
  }

  if (failed || !user) {
    return (
      <div className="sl-app">
        <main className="sl-session-state">
          <Brand />
          <div className="sl-card">
            <DataState
              kind={failed ? 'error' : 'loading'}
              title={failed ? 'Unable to load profile' : 'Opening your workspace'}
              description={
                failed
                  ? 'Your profile is temporarily unavailable. Check connectivity and try again.'
                  : 'Checking your account…'
              }
              action={
                failed && (
                  <>
                    <button className="sl-button sl-button-primary" onClick={() => setAttempt(value => value + 1)}>
                      Retry
                    </button>
                    <button className="sl-button" onClick={logout}>
                      Return to Log in
                    </button>
                  </>
                )
              }
            />
          </div>
        </main>
      </div>
    );
  }

  // Presentation scope only. Role gate ensures proper workspace routing.
  if (!canOpenWorkspacePath(user.role, pathname)) {
    return (
      <div className="sl-app">
        <main className="sl-session-state">
          <Brand />
          <div className="sl-card">
            <DataState
              kind="permission"
              title="This page is restricted"
              description="Your current account cannot access this workspace."
              action={
                <button
                  className="sl-button sl-button-primary"
                  onClick={() => router.replace(dashboardPaths[user.role] as Href)}
                >
                  Go to your dashboard
                </button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      ref={appRef}
      className="sl-app sl-shell"
      data-collapsed={railCollapsed}
      onScroll={event => setShowBackToTop(event.currentTarget.scrollTop > 520)}
    >
      <a className="sl-skip" href="#sl-main">
        Skip to main content
      </a>

      <aside className="sl-sidebar" aria-label="Application sidebar" onPointerEnter={sidebarHover.onPointerEnter} onPointerLeave={sidebarHover.onPointerLeave} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHoverExpanded(false); }}>
        <a href={dashboardPath} className="sl-brand" aria-label="ShelfLife AI home" onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (pathname !== dashboardPath) router.push(dashboardPath as Href);
        }}>
          <Brand inverse />
        </a>

        <div className="sl-sidebar-section">
          {renderNavigation(false)}
        </div>

      </aside>

      {/* Native hover titles plus a visible keyboard label avoid clipped sidebar tooltips. */}
      {railCollapsed && focusedNavigation && (
        <span className="sl-navigation-focus-label" style={{ top: focusedNavigation.top }} aria-hidden="true">
          {focusedNavigation.label}
        </span>
      )}

      {/* Native modal focus containment; closing restores focus to the opener. */}
      <dialog
        ref={drawer}
        className="sl-drawer"
        aria-label={`${user.role} navigation`}
        onClose={() => mobileButton.current?.focus()}
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          // Keep keyboard cycling inside the drawer, including unavailable destinations.
          const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sl-drawer-content">
          <div className="sl-drawer-header">
            <a href={dashboardPath} className="sl-brand" aria-label="ShelfLife AI home" onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); drawer.current?.close();
              if (pathname !== dashboardPath) router.push(dashboardPath as Href);
            }}>
              <Brand inverse />
            </a>
            <button
              className="sl-button sl-icon-button sl-drawer-close sl-close-button"
              onClick={() => drawer.current?.close()}
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="sl-drawer-nav">
            {renderNavigation(true)}
          </div>
        </div>
      </dialog>

      <Dialog
        open={confirmLogout}
        busy={logoutPending}
        showClose={false}
        className="sl-logout-dialog"
        title={<><span className="sl-logout-icon" aria-hidden="true"><LogOut size={20} /></span><span>Log out of ShelfLife AI?</span></>}
        onDismiss={() => setConfirmLogout(false)}
        returnFocus={logoutButton}
        actions={<>
          <button className="sl-button sl-logout-stay" disabled={logoutPending} data-initial-focus onClick={() => setConfirmLogout(false)}>Stay logged in</button>
          <button className="sl-button sl-button-logout" disabled={logoutPending} onClick={logout}>{logoutPending ? 'Logging out...' : 'Log out'}</button>
        </>}
      >
        <p className="sl-description">You’ll need to log in again to access your workspace.</p>
        {logoutError && <p role="alert" className="sl-field-error">Unable to end your session. Check your connection and try again.</p>}
      </Dialog>

      <div className="sl-workspace">
        <header className="sl-topbar">
          <div className="sl-topbar-left">
            <button
              ref={mobileButton}
              className="sl-button sl-icon-button sl-mobile-toggle"
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu size={18} aria-hidden="true" />
            </button>

            <div className="sl-global-search" role="search">
              <Search size={17} aria-hidden="true" />
              <input
                value={searchQuery}
                placeholder="Search pages and tools..."
                aria-label="Search workspace pages and tools"
                onFocus={() => setSearchOpen(true)}
                onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchQuery('');
                  } else if (event.key === 'Enter' && searchMatches[0]?.path) {
                    event.preventDefault();
                    router.push(searchMatches[0].path as Href);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
              />
              {searchOpen && searchQuery.trim() && (
                <div className="sl-search-results" role="listbox" aria-label="Search results">
                  {searchMatches.length ? searchMatches.map(item => item.path && (
                    <button
                      key={item.label}
                      type="button"
                      role="option"
                      className="sl-search-result"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        router.push(item.path as Href);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <item.Icon size={16} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  )) : <p className="sl-search-empty">No matching page, tool, or dashboard section</p>}
                </div>
              )}
            </div>
          </div>

          <div className="sl-topbar-right">
            {(user.role === 'Super Admin' || user.role === 'Inventory Staff' || isDashboardRoute) && <time className="sl-topbar-datetime" dateTime={topbarClock.toISOString()}>{topbarDateTime}</time>}
            <div className="sl-global-health" aria-label={`System status: ${systemHealth}`}>
              <span className="sl-global-health-label">System status</span>
              <span className="sl-global-health-value" data-state={systemHealth}>
                <span className="sl-status-dot" aria-hidden="true" />
                {systemHealth === 'checking' ? 'Checking' : systemHealth === 'healthy' ? 'Healthy' : systemHealth === 'attention' ? 'Needs attention' : 'Unavailable'}
              </span>
            </div>
            <Notifications open={notificationsOpen} onChange={changeNotifications} />

            <div
              className="sl-account"
              ref={accountRef}
              onPointerEnter={accountHover.onPointerEnter}
              onPointerLeave={accountHover.onPointerLeave}
              onBlur={event => {
                if (!confirmLogout && !event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
              }}
            >
              <button
                ref={accountButton}
                className="sl-account-toggle"
                aria-label="Account profile"
                aria-expanded={accountOpen}
                aria-controls="sl-account-panel"
                onClick={() => { accountHover.cancel(); setNotificationsOpen(false); setAccountOpen(value => !value); }}
              >
                <span className="sl-avatar sl-account-avatar" aria-hidden="true">
                  {sessionInitials(user)}
                </span>
                <ChevronDown size={14} aria-hidden="true" className="sl-account-chevron" />
              </button>

              {accountOpen && (
                <section id="sl-account-panel" className="sl-account-panel" aria-label="Account details">
                  <div className="sl-account-panel-header">
                    <span className="sl-avatar sl-avatar-lg" aria-hidden="true">
                      {sessionInitials(user)}
                    </span>
                    <div className="sl-account-panel-info">
                      <p className="sl-account-panel-name">{sessionDisplayName(user)}</p>
                      <p className="sl-account-panel-email">{user.email}</p>
                    </div>
                  </div>

                  <div className="sl-account-panel-footer">
                    <button ref={logoutButton} className="sl-button sl-button-logout" onClick={() => { accountHover.cancel(); setConfirmLogout(true); }}>
                      <LogOut size={15} aria-hidden="true" />
                      Log out
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </header>

        <main id="sl-main" tabIndex={-1} className="sl-main">
          {children(user, openArea)}
        </main>

        {showBackToTop && (
          <button
            className="sl-back-to-top"
            type="button"
            aria-label="Back to top"
            onClick={() => appRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUp size={19} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}