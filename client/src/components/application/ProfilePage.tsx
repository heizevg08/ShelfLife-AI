import { Activity, CalendarDays, Clock3, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { sessionDisplayName, sessionInitials } from '../../services/auth';
import { PageHeader, Card, Status } from './primitives';
import { useApplicationWorkspace } from './ApplicationWorkspace';

export function ProfilePage() {
  const { user } = useApplicationWorkspace();
  const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
  const displayName = sessionDisplayName(user);
  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? <time dateTime={value}>{date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
      : '—';
  };
  const lastLoginLabel = lastLogin && Number.isFinite(lastLogin.getTime())
    ? lastLogin.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'No recorded login';
  const accountStatus = user.isActive ? 'Active' : 'Deactivated';
  const details = [
    { label: 'Full Name', value: displayName || 'Unavailable', Icon: UserRound },
    { label: 'Email Address', value: user.email || 'Unavailable', Icon: Mail },
    { label: 'Role', value: user.role, Icon: ShieldCheck },
    { label: 'Account Status', value: <Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status>, Icon: Activity },
    { label: 'Last Login', value: user.lastLoginAt && lastLogin && Number.isFinite(lastLogin.getTime()) ? <time dateTime={user.lastLoginAt}>{lastLoginLabel}</time> : lastLoginLabel, Icon: Clock3 },
    { label: 'Created', value: formatTimestamp(user.createdAt), Icon: CalendarDays },
    { label: 'Last Updated', value: formatTimestamp(user.updatedAt), Icon: RefreshCw },
  ];
  return <>
    <PageHeader eyebrow="Account" title="My Profile" description="Review the identity and account details for your current signed-in session." />
    <div className="sl-admin-view sl-profile-page">
      <section className="sl-profile-identity" aria-labelledby="sl-profile-identity-name">
        <span className="sl-avatar sl-profile-avatar" aria-hidden="true">{sessionInitials(user)}</span>
        <div className="sl-profile-identity-copy">
          <h2 id="sl-profile-identity-name">{displayName}</h2>
          <p><span>{user.role}</span><span aria-hidden="true">·</span><span>{user.email}</span></p>
        </div>
        <Status tone={user.isActive ? 'success' : 'critical'}>{accountStatus}</Status>
      </section>

      <Card id="sl-profile-details" title="Account Information">
        <dl className="sl-profile-details-grid">
          {details.map(({ label, value, Icon }) => <div key={label} className="sl-profile-detail">
            <span className="sl-profile-detail-icon" aria-hidden="true"><Icon /></span>
            <div><dt>{label}</dt><dd>{value}</dd></div>
          </div>)}
        </dl>
      </Card>
    </div>
  </>;
}
