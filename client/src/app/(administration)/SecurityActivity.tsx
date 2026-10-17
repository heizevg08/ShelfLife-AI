'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { PageHeader } from '../../components/application/primitives';
import { AuditTable } from '../../components/application/AuditTable';
import { listAuditRecords, type AuditFilters } from '../../services/administration';

// Security & Activity owns four audit KPIs and one shared Audit Logs table.
//
// Every number is a server-side count: each card issues a one-row query through
// the same authorized GET /administration/audit-records contract the table uses
// and reads that page's `total`, so no figure is derived from the rows that
// happen to be loaded and none can be fabricated. The Active Sessions and
// Security Alerts cards stay removed — no sessions or security-alert service
// exists, and a card advertising a capability the product does not have is
// misleading.
//
// KPI windows (documented on the cards and in the audit docs):
//   Total Audit Events      all retained audit records — no window or filter
//   Events (Last 30 Days)   rolling 30-day window, server-side on `timestamp`
//   Successful Events       all retained records with status Success
//   Failed Events           all retained records with status Failed
// The status model is Success | Failed | Warning, so Total is deliberately not
// the sum of Successful and Failed; Warning records belong to Total alone.
const AUDIT_WINDOW_MS = 30 * 86400000;
// Same 15-second cadence as the shared table's own poll, so the cards cannot
// drift away from the records shown underneath them.
const KPI_REFRESH_MS = 15000;

interface AuditKpis { total: number; recent: number; successful: number; failed: number }

// The backend counts the matching page and returns its total; a one-row page is
// enough to read that total, so a count never transfers record payloads.
const auditCount = (filters: AuditFilters, signal: AbortSignal) =>
  listAuditRecords(1, 1, 'desc', filters, signal).then(page => page.total);

export default function SecurityActivity() {
  const [kpis, setKpis] = useState<AuditKpis | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    const from = new Date(Date.now() - AUDIT_WINDOW_MS).toISOString();
    Promise.all([
      auditCount({}, abort.signal),
      auditCount({ from }, abort.signal),
      auditCount({ status: 'Success' }, abort.signal),
      auditCount({ status: 'Failed' }, abort.signal),
    ])
      .then(([total, recent, successful, failed]) => { if (!abort.signal.aborted) setKpis({ total, recent, successful, failed }); })
      .catch(() => { if (!abort.signal.aborted) setKpis(null); });
    return () => abort.abort();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), KPI_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const cards = [
    { tone: 'brand', Icon: FileText, label: 'Total Audit Events', value: kpis?.total, caption: kpis ? 'All retained audit records' : 'Audit summary unavailable' },
    { tone: 'info', Icon: Clock3, label: 'Events (Last 30 Days)', value: kpis?.recent, caption: kpis ? 'Rolling 30-day window' : 'Audit summary unavailable' },
    { tone: 'attention', Icon: CheckCircle2, label: 'Successful Events', value: kpis?.successful, caption: kpis ? 'Records with a Success outcome' : 'Audit summary unavailable' },
    { tone: 'critical', Icon: AlertTriangle, label: 'Failed Events', value: kpis?.failed, caption: kpis ? 'Records with a Failed outcome' : 'Audit summary unavailable' },
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
