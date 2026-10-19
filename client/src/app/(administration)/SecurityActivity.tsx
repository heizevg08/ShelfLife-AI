'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { PageHeader } from '../../components/application/primitives';
import { AuditTable } from '../../components/application/AuditTable';
import { listAuditRecords, type AuditFilters } from '../../services/administration';
import { formatDateTime } from '../../utils/date-time';

// Security & Activity owns four audit KPIs and one shared Audit Logs table.
//
// Every number is a server-side count or query:
//   Total Audit Events   all retained audit records — no window or filter
//   Success Rate         percentage of retained audit records with status Success
//   Latest Activity      most recent recorded audit event timestamp
//   Failed Events        all retained records with status Failed
// The status model is Success | Failed | Warning.
const KPI_REFRESH_MS = 15000;

interface AuditKpis { total: number; successful: number; failed: number; latestTimestamp: string | null }

// The backend counts the matching page and returns its total; a one-row page is
// enough to read that total, so a count never transfers record payloads.
const auditCount = (filters: AuditFilters, signal: AbortSignal) =>
  listAuditRecords(1, 1, 'desc', filters, signal).then(page => page.total);

export default function SecurityActivity() {
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      auditCount({}, abort.signal),
      auditCount({ status: 'Success' }, abort.signal),
      auditCount({ status: 'Failed' }, abort.signal),
      listAuditRecords(1, 1, 'desc', {}, abort.signal).then(page => page.items[0]?.timestamp ?? null),
    ])
      .then(([total, successful, failed, latestTimestamp]) => {
        if (!abort.signal.aborted) setKpis({ total, successful, failed, latestTimestamp });
      })
      .catch(() => { if (!abort.signal.aborted) setKpis(null); });
    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), KPI_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const successRate = kpis && kpis.total > 0
    ? `${Math.round((kpis.successful / kpis.total) * 100)}%`
    : kpis?.total === 0 ? '100%' : undefined;

  const latestActivityLabel = kpis?.latestTimestamp
    ? formatDateTime(kpis.latestTimestamp)
    : kpis && kpis.total === 0 ? 'None' : undefined;

  const cards = [
    { tone: 'brand', Icon: FileText, label: 'Total Audit Events', value: kpis?.total !== undefined ? kpis.total.toLocaleString() : '—', caption: kpis ? 'All retained audit records' : 'Audit summary unavailable' },
    { tone: 'info', Icon: CheckCircle2, label: 'Success Rate', value: successRate ?? '—', caption: kpis ? `${kpis.successful.toLocaleString()} successful records` : 'Audit summary unavailable' },
    { tone: 'attention', Icon: Activity, label: 'Latest Activity', value: latestActivityLabel ?? '—', caption: kpis?.latestTimestamp ? 'Most recent recorded event' : kpis ? 'No recorded events yet' : 'Audit summary unavailable' },
    { tone: 'critical', Icon: AlertTriangle, label: 'Failed Events', value: kpis?.failed !== undefined ? kpis.failed.toLocaleString() : '—', caption: kpis ? 'Records with a Failed outcome' : 'Audit summary unavailable' },
  ] as const;

  return (
    <div className="sl-superadmin-surface sl-security-activity-v78 sl-staff-usage-v150" data-ui-version="dashboard-kpi-parity">
      <PageHeader
        eyebrow="Administration"
        title="Security & Activity"
        description="Monitor user activity and audit records across ShelfLife AI."
      />

      {/* The KPI strip reuses the Admin account card contract (sl-inventory-staff-kpis /
          sl-inventory-staff-kpi) instead of owning a Super Admin variant, so sizing,
          icon treatment, border accents and the four-column desktop grid stay identical
          to the locked /UserManagement cards. */}
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-admin-user-kpis sl-dashboard-kpis sl-superadmin-kpis sl-user-management-kpis" aria-label="Security overview">
        {cards.map(({ tone, Icon, label, value, caption }) => (
          <article key={label} className="sl-sa-kpi sl-inventory-staff-kpi" data-tone={tone}>
            <span className="sl-sa-kpi-icon"><Icon aria-hidden="true" /></span>
            <div><span>{label}</span><strong>{value !== undefined ? value.toLocaleString() : '—'}</strong><small>{caption}</small></div>
          </article>
        ))}
      </section>

      {/* showSummary={false}: this page already owns the truthful KPI strip above, and the
          shared table's own audit summary would duplicate it. Admin keeps the default. */}
      <AuditTable adminOverview includeSuperAdminActors showSummary={false} constrainActorCell />
    </div>
  );
}
