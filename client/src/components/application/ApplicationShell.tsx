import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { AuthRequestError, currentUser, logout as endSession, type SessionUser } from '../../services/auth';
import { DataState } from './primitives';
import { Brand } from './Brand';
import { Dialog } from './Dialog';
import { useHoverIntent } from './useHoverIntent';
import { Notifications } from './Notifications';
import { administrationAreas, type AdministrationAreaId } from './administration';
import '../../styles/application.css';

const dashboardPath = '/SuperAdminDashboard';

// Visibility follows the Super Admin workspace; this is not backend authorization.
const destinations: { label: string; Icon: typeof LayoutDashboard; path?: string; id?: AdministrationAreaId }[] = [
  { label: 'Dashboard', Icon: LayoutDashboard, path: dashboardPath },
  ...administrationAreas,
];

export default function ApplicationShell({ children }: { children: (user: SessionUser, openArea: (id: AdministrationAreaId) => void) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
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
    // Release the modal drawer when crossing the CSS desktop breakpoint.
    const media = window.matchMedia('(min-width: 769px)');
    const closeOnDesktop = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
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
      <nav aria-label={mobile ? 'Super Admin mobile navigation' : 'Super Admin navigation'} className="sl-navigation">
        {destinations.map(({ label, Icon, path, id }) =>
          path ? (
            <a
              key={label}
              href={path}
              className="sl-nav-item"
              aria-current={pathname === path ? 'page' : undefined}
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
          ) : (
            <button
              key={label}
              type="button"
              className="sl-nav-item"
              aria-haspopup="dialog"
              onClick={() => id && openArea(id)}
              aria-label={label}
              title={!mobile && railCollapsed ? label : undefined}
              onFocus={event => !mobile && railCollapsed && setFocusedNavigation({ label, top: event.currentTarget.getBoundingClientRect().top })}
              onBlur={() => setFocusedNavigation(null)}
              onKeyDown={event => { if (event.key === 'Escape') setFocusedNavigation(null); }}
            >
              <Icon size={20} aria-hidden="true" className="sl-nav-icon" />
              <span className={mobile ? 'sl-nav-label' : 'sl-nav-label sl-desktop-label'}>{label}</span>
            </button>
          )
        )}
      </nav>
    );
  }

  if (loading || (!user && !failed)) {
    // Never render protected identity or dashboard data while the server verifies the session.
    return <div className="sl-app sl-session-pending">
      <Brand />
      <main className="sl-session-progress" role="status" aria-label="Checking your account">
        <LoaderCircle className="sl-spin" size={18} aria-hidden="true" />
        <span className="sl-supporting">Checking your account...</span>
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
  if (user.role !== 'Super Admin') {
    return (
      <div className="sl-app">
        <main className="sl-session-state">
          <Brand />
          <div className="sl-card">
            <DataState
              kind="permission"
              title="This page is restricted"
              description="This page is available to Super Admin accounts."
              action={
                <button
                  className="sl-button sl-button-primary"
                  onClick={() =>
                    router.replace(
                      user.role === 'Admin'
                        ? '/pages/AdminDash'
                        : user.role === 'Manager'
                        ? '/pages/InManager'
                        : '/pages/InStaff'
                    )
                  }
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
    <div className="sl-app sl-shell" data-collapsed={railCollapsed}>
      <a className="sl-skip" href="#sl-main">
        Skip to main content
      </a>

      <aside className="sl-sidebar" aria-label="Application sidebar" onPointerEnter={sidebarHover.onPointerEnter} onPointerLeave={sidebarHover.onPointerLeave} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHoverExpanded(false); }}>
        <a href={dashboardPath} className="sl-brand" aria-label="ShelfLife AI home" onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (pathname !== dashboardPath) router.push(dashboardPath);
        }}>
          <Brand inverse />
        </a>

        <div className="sl-sidebar-section">
          <p className="sl-eyebrow sl-desktop-label">Administration</p>
          {renderNavigation(false)}
        </div>

        <div className="sl-sidebar-bottom">
          <button
            className="sl-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
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
        aria-label="Super Admin navigation"
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
              if (pathname !== dashboardPath) router.push(dashboardPath);
            }}>
              <Brand inverse />
            </a>
            <button
              className="sl-button sl-icon-button sl-drawer-close"
              onClick={() => drawer.current?.close()}
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="sl-drawer-nav">
            <p className="sl-eyebrow">Administration</p>
            {renderNavigation(true)}
          </div>
        </div>
      </dialog>

      <Dialog open={confirmLogout} busy={logoutPending} showClose={false} title="Log out of ShelfLife AI?" onDismiss={() => setConfirmLogout(false)} returnFocus={logoutButton} actions={<>
        <button className="sl-button" disabled={logoutPending} data-initial-focus onClick={() => setConfirmLogout(false)}>Stay logged in</button>
        <button className="sl-button sl-button-logout" disabled={logoutPending} onClick={logout}>{logoutPending ? 'Logging out...' : 'Log out'}</button>
      </>}><p className="sl-description">You’ll need to log in again to access your workspace.</p>
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


          </div>

          <div className="sl-topbar-right">
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
                <span className="sl-avatar" aria-hidden="true">
                  {user.name
                    .split(/\s+/)
                    .map(part => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
                <ChevronDown size={14} aria-hidden="true" className="sl-account-chevron" />
              </button>

              {accountOpen && (
                <section id="sl-account-panel" className="sl-account-panel" aria-label="Account details">
                  <div className="sl-account-panel-header">
                    <span className="sl-avatar sl-avatar-lg" aria-hidden="true">
                      {user.name
                        .split(/\s+/)
                        .map(part => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div className="sl-account-panel-info">
                      <p className="sl-account-panel-name">{user.name}</p>
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
      </div>
    </div>
  );
}
