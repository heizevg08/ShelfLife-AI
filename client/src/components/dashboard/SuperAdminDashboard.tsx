import { useEffect, useState } from 'react';
import { Activity, ChevronRight, Check, CircleHelp, RefreshCw } from 'lucide-react';
import type { SessionUser } from '../../services/auth';
import { getSystemAvailability, type SystemAvailability } from '../../services/system';
import { Card, DashboardGrid, PageHeader, DataState, Status, SummaryItems, UnavailableTable } from '../application/primitives';
import { administrationAreas, type AdministrationAreaId } from '../application/administration';

export default function SuperAdminDashboard({ user, onOpenArea }: { user: SessionUser; onOpenArea: (id: AdministrationAreaId) => void }) {
  const [refresh, setRefresh] = useState(0);
  const [availability, setAvailability] = useState<SystemAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');

  // Use local time only after hydration; exports must not depend on build time.
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => {
    // Cancel stale checks without changing the existing API or timeout boundary.
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(false);
    setAvailability(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    getSystemAvailability(controller.signal)
      .then(result => { if (active) setAvailability(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [refresh]);

  const displayName = user.name.trim();
  const ready = availability?.backendAlive && availability.backendReady;
  const status = loading ? 'Checking' : error ? 'Status unavailable' : ready ? 'Available' : 'Needs attention';
  const checks = [
    { label: 'Application connection', value: availability?.backendAlive, good: 'Responding', bad: 'Unavailable' },
    { label: 'Ready to use', value: availability?.backendReady, good: 'Ready', bad: 'Not ready' },
  ];

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={displayName ? `${greeting}, ${displayName}.` : `${greeting}.`} description="System status and administration tools, at a glance." />

      <DashboardGrid>
        <section className="sl-health-panel" aria-labelledby="sl-health-title" data-state={loading || error ? 'unknown' : ready ? 'available' : 'attention'}>
          <div className="sl-health-panel-header">
            <div className="sl-heading-with-icon">
              <Activity size={20} aria-hidden="true" />
              <h2 id="sl-health-title" className="sl-section-title">Application availability</h2>
            </div>
            <button className="sl-button sl-refresh-btn" disabled={loading} aria-label="Refresh system status" onClick={() => setRefresh(value => value + 1)}>
              <RefreshCw size={16} aria-hidden="true" className={loading ? 'sl-spin' : undefined} /><span className="sl-refresh-label">Refresh</span>
            </button>
          </div>
          <div className="sl-availability-summary" role="status" aria-busy={loading}>
            <span className="sl-availability-symbol" aria-hidden="true">{loading ? <RefreshCw className="sl-spin" /> : error ? <CircleHelp /> : ready ? <Check /> : <Activity />}</span>
            <div>
              <p className="sl-availability-value">{status}</p>
              <p className="sl-supporting">{loading ? 'Checking the application…' : error ? 'A current status could not be confirmed.' : ready ? 'ShelfLife AI is responding and ready to use.' : 'One or more application checks need attention.'}</p>
            </div>
          </div>
          {error && <DataState kind="error" title="Couldn’t check system status" description="Check your connection and refresh to try again." />}
          <dl className="sl-service-checks">
            {checks.map(check => (
              <div key={check.label}>
                <dt>{check.label}</dt>
                <dd><Status tone={loading || error ? 'neutral' : check.value ? 'success' : 'attention'}>
                  {loading ? 'Checking' : error ? 'Unknown' : check.value ? check.good : check.bad}
                </Status></dd>
              </div>
            ))}
          </dl>
          {/* This is the time of this check, never an uptime or incident-history claim. */}
          <p className="sl-check-timestamp sl-supporting">{availability ? 'Last checked at ' + availability.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : loading ? 'Waiting for current results…' : 'No current results available'}</p>
        </section>

        <Card id="sl-administration-tools" title="Administration tools">
          <p className="sl-tools-note sl-supporting">Open an administration area.</p>
          <ul className="sl-tools-list">
            {administrationAreas.map(({ id, label, Icon, summary }) => <li key={id}>
              <button onClick={() => onOpenArea(id)} className="sl-tool-button">
                <Icon size={20} aria-hidden="true" />
                <span><span className="sl-card-title">{label}</span><span className="sl-supporting">{summary}</span></span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>)}
          </ul>
        </Card>
      </DashboardGrid>

      {/* Missing services never imply zero accounts, no incidents, or a healthy inventory. */}
      <DashboardGrid>
        <Card id="sl-admin-summary" title="Admin-account overview">
          <SummaryItems items={[{ label: 'All Admin accounts' }, { label: 'Active' }, { label: 'Disabled' }]} />
          <div className="sl-related-actions"><button className="sl-button" onClick={() => onOpenArea('accounts')}>View account directory</button></div>
        </Card>
        <Card id="sl-security-summary" title="Security overview">
          <SummaryItems items={[{ label: 'Security events' }, { label: 'Active-session monitoring' }]} />
          <div className="sl-related-actions"><button className="sl-button" onClick={() => onOpenArea('security')}>View Security & Activity</button></div>
        </Card>
      </DashboardGrid>
      <Card id="sl-operational-exceptions" title="Operational exceptions">
        <SummaryItems items={[{ label: 'Critical inventory alerts' }, { label: 'Critical / expired batches' }, { label: 'High expiration risk' }]} />
        <p className="sl-section-note sl-supporting">Operational summaries are unavailable. This area is read-only.</p>
      </Card>
      <Card id="sl-recent-audit" title="Recent administrative activity">
        <UnavailableTable label="Recent administrative activity" columns={['Timestamp', 'Actor', 'Action', 'Resource']}
          description="Protected audit history will appear here when connected. No recent activity can currently be confirmed." />
      </Card>
    </>
  );
}
