import { Link } from 'expo-router';
import { AlertTriangle, ArrowRight, Box, FileText, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dashboardSummary, listAccounts, listAuditRecords, type Account, type AuditRecord, type DashboardSummary } from '../../services/administration';
import type { SessionUser } from '../../services/auth';
import { Card, DataState, Status, PageHeader} from '../application/primitives';

const AUTO_REFRESH_MS = 15000;
const roleOrder = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;

function UnavailableMetric({ label }: { label: string }) {
  return <div className="sl-sa-unavailable"><strong>—</strong><span>{label}</span></div>;
}

export default function SuperAdminDashboard({ user }: { user: SessionUser }) {
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    };
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsTotal, setAccountsTotal] = useState<number | null>(null);
  const [accountsError, setAccountsError] = useState(false);
  const [audit, setAudit] = useState<{ items: AuditRecord[]; total: number } | null>(null);
  const [auditError, setAuditError] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setSummaryError(false); setAccountsError(false); setAuditError(false);
    Promise.allSettled([
      dashboardSummary(abort.signal),
      listAccounts(1, 'createdAt', 'desc', abort.signal),
      listAuditRecords(1, 5, 'desc', {}, abort.signal),
    ]).then(([summaryResult, accountsResult, auditResult]) => {
      if (abort.signal.aborted) return;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value); else setSummaryError(true);
      if (accountsResult.status === 'fulfilled') {
        setAccounts(accountsResult.value.items);
        setAccountsTotal(accountsResult.value.total);
      } else { setAccounts([]); setAccountsTotal(null); setAccountsError(true); }
      if (auditResult.status === 'fulfilled') setAudit({ items: auditResult.value.items, total: auditResult.value.total });
      else { setAudit(null); setAuditError(true); }
    });
    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const completeRoleDistribution = useMemo(() => {
    if (accountsTotal === null || accounts.length !== accountsTotal) return null;
    return roleOrder.map(role => ({ role, count: accounts.filter(account => account.role === role).length }));
  }, [accounts, accountsTotal]);

  const totalUsers = summary?.totalUsers ?? accountsTotal;
  return <div className="sl-admin-view sl-superadmin-dashboard sl-superadmin-dashboard-v49 sl-staff-usage-v150">
    <div className="sl-dashboard-heading sl-dashboard-heading-v8 sl-superadmin-dashboard-heading">
      <PageHeader eyebrow="Dashboard" title={`${greeting}, ${user.firstName || 'Super Admin'}.`} />
      <p className="sl-dashboard-description">Monitor system-wide activity, security, operations and administrative oversight.</p>
    </div>
    <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="System overview">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Total Users</span><strong>{totalUsers?.toLocaleString() ?? (summaryError && accountsError ? 'Unavailable' : 'Loading…')}</strong><small>System-wide accounts</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UsersRound /></span><div><span>Active Accounts</span><strong>{summary?.activeUsers.toLocaleString() ?? (summaryError ? 'Unavailable' : 'Loading…')}</strong><small>{summary ? `${summary.inactiveUsers.toLocaleString()} inactive` : 'Live account status'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Box /></span><div><span>Ingredients Tracked</span><strong>—</strong><small>Awaiting oversight API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Active Alerts</span><strong>—</strong><small>Awaiting alert summary API</small></div></article>
    </section>

    <section className="sl-sa-analytics-row">
      <Card id="sl-sa-expiration" title="Expiration Status (All Ingredients)"><div className="sl-sa-preview-state"><DataState kind="empty" title="No live records yet" description="Expiration analytics" action={<Status>Preview · data pending</Status>} /></div></Card>
      <Card id="sl-sa-waste" title="Waste Trend (Last 6 Months)"><div className="sl-sa-preview-state"><DataState kind="empty" title="No live records yet" description="Waste analytics" action={<Status>Preview · data pending</Status>} /></div></Card>
      <Card id="sl-sa-forecast" title="Forecast Accuracy (Last 6 Months)"><div className="sl-sa-preview-state"><DataState kind="empty" title="No live records yet" description="Forecast accuracy" action={<Status>Preview · data pending</Status>} /></div></Card>
    </section>

    <section className="sl-sa-middle-row">
      <Card id="sl-sa-expiring-items" title="Critical / Expiring Items" action={<Link href="/ExpirationMonitoring" className="sl-text-link">View all <ArrowRight size={14}/></Link>}>
        <DataState kind="empty" title="No live records yet" description="Expiration / FEFO records" action={<Status>Preview · data pending</Status>} />
      </Card>
      <Card id="sl-sa-recent-activity" title="Recent System Activity" action={<Link href="/SecurityActivity" className="sl-text-link">View all <ArrowRight size={14}/></Link>}>
        {auditError ? <DataState kind="error" title="Activity could not be loaded" description="Check connectivity and try again." /> : !audit ? <DataState kind="loading" title="Loading activity" description="" /> : <div className="sl-table-scroll"><table className="sl-data-table sl-sa-activity-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>{audit.items.length === 0 ? <tr><td colSpan={4} className="sl-empty-table-message">No system activity recorded yet.</td></tr> : audit.items.map(row => <tr key={row.id}><td>{new Date(row.timestamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true})}</td><td>{row.actor.name}<small>{row.actor.role}</small></td><td>{row.action.replaceAll('_',' ')}</td><td>{row.targetType}<small>{row.targetId}</small></td></tr>)}</tbody></table></div>}
      </Card>
    </section>

    <section className="sl-sa-bottom-row">
      <Card id="sl-sa-services" title="System Services"><div className="sl-sa-service-list"><div><span><ShieldCheck size={16}/> Application API</span><Status tone="success">Connected through current session</Status></div><div><span><Box size={16}/> Database</span><Status>Detailed health unavailable</Status></div><div><span><FileText size={16}/> File Storage</span><Status>Health unavailable</Status></div><div><span><LockKeyhole size={16}/> Authentication</span><Status tone="success">Session verified</Status></div></div></Card>
      <Card id="sl-sa-distribution" title="User Distribution (All Roles)">{completeRoleDistribution ? <div className="sl-sa-role-distribution"><div className="sl-sa-role-total"><strong>{accountsTotal}</strong><span>Users</span></div><div className="sl-sa-role-legend">{completeRoleDistribution.map(item => <div key={item.role}><span>{item.role}</span><strong>{item.count}</strong></div>)}</div></div> : <DataState kind="empty" title="No live records yet" description="User distribution" action={<Status>Preview · data pending</Status>} />}</Card>
      <Card id="sl-sa-security" title="Security Overview" action={<Link href="/SecurityActivity" className="sl-text-link">View all <ArrowRight size={14}/></Link>}><div className="sl-sa-security-grid"><div><ShieldCheck/><span>Audit Records</span><strong>{audit?.total.toLocaleString() ?? (auditError ? 'Unavailable' : 'Loading…')}</strong></div><div><LockKeyhole/><span>Security Events</span><UnavailableMetric label="No summary API" /></div><div><AlertTriangle/><span>Failed Login Attempts</span><UnavailableMetric label="No summary API" /></div><div><UsersRound/><span>Active Sessions</span><UnavailableMetric label="No summary API" /></div></div></Card>
    </section>
  </div>;
}
