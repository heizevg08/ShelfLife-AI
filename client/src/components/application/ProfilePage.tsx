import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, type Href } from '../../routing/navigation';
import { Activity, Bell, CalendarDays, ChevronRight, Clock3, Home, KeyRound, LockKeyhole, Mail, MonitorCog, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, UserRound, Zap } from 'lucide-react';
import { sessionDisplayName, sessionInitials, type SessionUser } from '../../services/auth';
import { PageHeader, Status } from './primitives';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { dashboardPaths } from './workspace';
import { formatDateTime } from '../../utils/date-time';

type ProfileTab = 'profile' | 'settings' | 'security';

const tabs = [
  { id: 'profile', label: 'Profile', Icon: UserRound },
  { id: 'settings', label: 'Settings', Icon: Settings2 },
  { id: 'security', label: 'Security', Icon: ShieldCheck },
] as const;

function ProfileCard({ icon, title, description, tone, children }: { icon: ReactNode; title: string; description: string; tone?: 'security'; children: ReactNode }) {
  const headingId = `sl-profile-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return <section className="sl-profile-card" data-tone={tone} aria-labelledby={headingId}>
    <header className="sl-profile-card-header">
      <span className="sl-profile-card-icon" aria-hidden="true">{icon}</span>
      <span><h2 id={headingId}>{title}</h2><p>{description}</p></span>
    </header>
    {children}
  </section>;
}

function PendingCapability({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="sl-profile-capability">
    <span className="sl-profile-capability-icon" aria-hidden="true">{icon}</span>
    <span className="sl-profile-capability-copy"><strong>{title}</strong><small>{description}</small></span>
    <span className="sl-profile-pending">Preview · data pending</span>
  </div>;
}

function PendingPanel({ tab }: { tab: Exclude<ProfileTab, 'profile'> }) {
  const security = tab === 'security';
  return <section className="sl-profile-tab-pending" role="tabpanel" id={`sl-profile-${tab}-panel`} aria-labelledby={`sl-profile-${tab}-tab`} tabIndex={0}>
    <span className="sl-profile-tab-pending-icon" aria-hidden="true">{security ? <ShieldCheck /> : <Settings2 />}</span>
    <h2>{security ? 'Security controls are not connected yet' : 'Account preferences are not connected yet'}</h2>
    <p>{security ? 'Password and active-session management will appear here when the authenticated security service is available.' : 'Notification and appearance preferences will appear here when preference storage is available.'}</p>
    <span className="sl-profile-pending">Preview · data pending</span>
  </section>;
}

function InventoryStaffProfileSettings({ user }: { user: SessionUser }) {
  const displayName = sessionDisplayName(user);
  const accountStatus = user.isActive ? 'Active' : 'Deactivated';
  const timestamp = (value?: string) => value && Number.isFinite(new Date(value).getTime())
    ? <time dateTime={value}>{formatDateTime(value)}</time>
    : '—';
  const lastLogin = user.lastLoginAt && Number.isFinite(new Date(user.lastLoginAt).getTime())
    ? <time dateTime={user.lastLoginAt}>{formatDateTime(user.lastLoginAt)}</time>
    : 'No recorded login';
  const accessDetails = [
    { label: 'Role', value: user.role },
    { label: 'Account Status', value: <Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status> },
    { label: 'Last Login', value: lastLogin },
    { label: 'Created', value: timestamp(user.createdAt) },
    { label: 'Last Updated', value: timestamp(user.updatedAt) },
  ];

  return <>
    <nav className="sl-profile-breadcrumb" aria-label="Breadcrumb">
      <Link href={dashboardPaths[user.role] as Href} aria-label="Home"><Home aria-hidden="true" /></Link>
      <ChevronRight aria-hidden="true" /><span>Account</span><ChevronRight aria-hidden="true" /><span aria-current="page">Profile Settings</span>
    </nav>
    <PageHeader eyebrow="Account" title="Profile Settings" description="View your profile information and account access details." />
    <div className="sl-admin-view sl-profile-page sl-inventory-staff-profile-settings">
      <ProfileCard icon={<UserRound />} title="Profile Information" description="View your account identity and contact information.">
        <div className="sl-inventory-staff-profile-identity">
          <span className="sl-avatar sl-profile-avatar" aria-hidden="true">{sessionInitials(user)}</span>
          <div className="sl-inventory-staff-profile-identity-copy">
            <h3>{displayName}</h3>
            <div><span className="sl-profile-role">{user.role}</span><Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status></div>
          </div>
        </div>
        <dl className="sl-inventory-staff-profile-information-grid">
          <div><dt>Full Name</dt><dd>{displayName || 'Unavailable'}</dd></div>
          <div><dt>Email Address</dt><dd>{user.email || 'Unavailable'}</dd></div>
        </dl>
        <p className="sl-inventory-staff-profile-managed-note">Account information is managed by an administrator.</p>
      </ProfileCard>

      <ProfileCard icon={<ShieldCheck />} title="Account & Access" description="Review your account status and access information.">
        <dl className="sl-inventory-staff-profile-access-grid">
          {accessDetails.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}
        </dl>
      </ProfileCard>
    </div>
  </>;
}

export function ProfilePage() {
  const { user } = useApplicationWorkspace();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  if (user.role === 'Inventory Staff') return <InventoryStaffProfileSettings user={user} />;
  const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
  const displayName = sessionDisplayName(user);
  const accountStatus = user.isActive ? 'Active' : 'Deactivated';
  const formatTimestamp = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? <time dateTime={value}>{formatDateTime(value)}</time>
      : '—';
  };
  const lastLoginLabel = lastLogin && Number.isFinite(lastLogin.getTime())
    ? <time dateTime={user.lastLoginAt}>{formatDateTime(lastLogin)}</time>
    : 'No recorded login';
  const details = [
    { label: 'Full Name', value: displayName || 'Unavailable', Icon: UserRound },
    { label: 'Email Address', value: user.email || 'Unavailable', Icon: Mail },
    { label: 'Role', value: user.role, Icon: ShieldCheck },
    { label: 'Account Status', value: <Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status>, Icon: Activity },
    { label: 'Last Login', value: lastLoginLabel, Icon: Clock3 },
    { label: 'Created', value: formatTimestamp(user.createdAt), Icon: CalendarDays },
    { label: 'Last Updated', value: formatTimestamp(user.updatedAt), Icon: RefreshCw },
  ];
  const changeTab = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const controls = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const current = controls.indexOf(event.currentTarget);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
    controls[next]?.focus();
    controls[next]?.click();
  };

  return <>
    <nav className="sl-profile-breadcrumb" aria-label="Breadcrumb">
      <Link href={dashboardPaths[user.role] as Href} aria-label="Home"><Home aria-hidden="true" /></Link>
      <ChevronRight aria-hidden="true" /><span>Account</span><ChevronRight aria-hidden="true" /><span aria-current="page">My Profile</span>
    </nav>
    <PageHeader title="My Profile" description="View and manage your account details and preferences." />
    <div className="sl-admin-view sl-profile-page">
      <div className="sl-profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map(({ id, label, Icon }) => <button key={id} id={`sl-profile-${id}-tab`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`sl-profile-${id}-panel`} tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={changeTab}><Icon aria-hidden="true" />{label}</button>)}
      </div>

      {activeTab === 'profile' ? <div className="sl-profile-layout" role="tabpanel" id="sl-profile-profile-panel" aria-labelledby="sl-profile-profile-tab">
        <div className="sl-profile-primary">
          <section className="sl-profile-identity" aria-labelledby="sl-profile-identity-name">
            <div className="sl-profile-identity-main">
              <span className="sl-avatar sl-profile-avatar" aria-hidden="true">{sessionInitials(user)}</span>
              <div className="sl-profile-identity-copy">
                <h2 id="sl-profile-identity-name">{displayName}</h2>
                <span className="sl-profile-role">{user.role}</span>
                <p>{user.email}</p>
              </div>
            </div>
            <div className="sl-profile-account-state">
              <Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status>
              <p>{user.isActive ? 'Account is active and can access ShelfLife AI.' : 'Account access is currently deactivated.'}</p>
            </div>
          </section>

          <ProfileCard icon={<UserRound />} title="Account Information" description="Your account details and session information.">
            <dl className="sl-profile-details-grid">
              {details.map(({ label, value, Icon }) => <div key={label} className="sl-profile-detail">
                <span className="sl-profile-detail-icon" aria-hidden="true"><Icon /></span>
                <div><dt>{label}</dt><dd>{value}</dd></div>
              </div>)}
            </dl>
          </ProfileCard>
        </div>

        <aside className="sl-profile-secondary" aria-label="Account capabilities">
          <ProfileCard icon={<Zap />} title="Quick Actions" description="Common account actions.">
            <div className="sl-profile-capability-list">
              <PendingCapability icon={<UserRound />} title="Edit Profile" description="Update your personal information." />
              <PendingCapability icon={<KeyRound />} title="Change Password" description="Keep your account secure." />
            </div>
          </ProfileCard>
          <ProfileCard icon={<SlidersHorizontal />} title="Account Settings" description="Manage your preferences.">
            <div className="sl-profile-capability-list">
              <PendingCapability icon={<Bell />} title="Notification Preferences" description="Choose what updates you receive." />
              <PendingCapability icon={<MonitorCog />} title="Appearance" description="Adjust the interface to your preference." />
            </div>
          </ProfileCard>
          <ProfileCard icon={<LockKeyhole />} title="Account Security" description="Keep your account safe." tone="security">
            <div className="sl-profile-capability-list">
              <PendingCapability icon={<KeyRound />} title="Password & Authentication" description="Update your password and manage security." />
              <PendingCapability icon={<ShieldCheck />} title="Active Sessions" description="View and manage your active sessions." />
            </div>
          </ProfileCard>
        </aside>
      </div> : <PendingPanel tab={activeTab} />}
    </div>
  </>;
}
