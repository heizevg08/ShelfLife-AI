import { Link } from 'expo-router';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardSummary, listAccounts, type Account, type DashboardSummary } from '../../services/administration';
import type { SessionUser } from '../../services/auth';
import { AuditTable } from '../application/AuditTable';
import { Card, PageHeader, Status, SummaryCards } from '../application/primitives';
import { ChangeRequestOverview } from '../shared/dashboard/ChangeRequestOverview';
import { WasteForecastAnalytics } from '../shared/dashboard/WasteForecastAnalytics';

const AUTO_REFRESH_MS = 15000;

export default function SuperAdminDashboard({ user }: { user: SessionUser }) {
  const [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now);
      const hour = now.getHours();
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    };
    updateClock();
    const interval = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    setSummaryError(false);
    setAccountsError(false);

    Promise.allSettled([
      dashboardSummary(abort.signal),
      listAccounts(1, 'createdAt', 'desc', abort.signal),
    ]).then(([summaryResult, accountsResult]) => {
      if (abort.signal.aborted) return;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      else setSummaryError(true);

      if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value.items.slice(0, 4));
      else {
        setAccounts([]);
        setAccountsError(true);
      }
    });

    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const displayName = user.name.trim();
  const dateTimeLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(clock);

  return (
    <>
      <div className="sl-dashboard-heading sl-dashboard-heading-v8">
        <PageHeader
          eyebrow="Dashboard"
          title={displayName ? `${greeting}, ${displayName}.` : `${greeting}.`}
        />
        <time className="sl-dashboard-datetime" dateTime={clock.toISOString()}>{dateTimeLabel}</time>
      </div>

      <div className="sl-admin-view sl-superadmin-dashboard">
        <SummaryCards items={[
          { label: 'Total users', value: summary?.totalUsers.toLocaleString() ?? (summaryError ? 'Unavailable' : 'Loading…'), detail: 'Real account records', tone: 'brand', trend: 'line' },
          { label: 'Active accounts', value: summary?.activeUsers.toLocaleString() ?? (summaryError ? 'Unavailable' : 'Loading…'), detail: 'Real account records', tone: 'success', trend: 'accuracy' },
          { label: 'Open alerts', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting alert service', tone: 'attention', trend: 'bars' },
          { label: 'Pending requests', value: <span className="sl-placeholder-value">—</span>, detail: 'Awaiting request service', tone: 'critical', trend: 'segments' },
        ]} />

        <div className="sl-superadmin-primary-grid">
          <Card
            id="sl-dashboard-users"
            title="User Accounts"
            action={<Link href="/UserManagement" className="sl-text-link">Manage users <ArrowRight size={15} aria-hidden="true" /></Link>}
          >
            {accountsError ? (
              <p className="sl-state-inline">Account records could not be loaded.</p>
            ) : (
              <div className="sl-table-scroll" role="region" aria-label="Recent user accounts" tabIndex={0}>
                <table className="sl-data-table sl-compact-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Activity</th></tr></thead>
                  <tbody>
                    {!accounts.length && <tr><td colSpan={4} className="sl-empty-table-message">No subordinate accounts yet.</td></tr>}
                    {accounts.map(account => <tr key={account.id}>
                      <td>{account.name}</td>
                      <td>{account.email}</td>
                      <td>{account.role}</td>
                      <td><Status tone={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Last activity unavailable'}</Status></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <ChangeRequestOverview />
        </div>

        <Card
          id="sl-recent-audit"
          title="Recent Audit Logs"
          action={<Link href="/AdministrativeAudit" className="sl-text-link">View all logs <ArrowRight size={15} aria-hidden="true" /></Link>}
        >
          <AuditTable recent />
        </Card>

        <WasteForecastAnalytics />
      </div>
    </>
  );
}
