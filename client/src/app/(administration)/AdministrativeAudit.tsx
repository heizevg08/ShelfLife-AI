import { AuditTable } from '../../components/application/AuditTable';
import { Card, PageHeader } from '../../components/application/primitives';

export default function AdministrativeAudit() {
  return <>
    <PageHeader eyebrow="Security & Activity" title="Audit Logs" description="Protected records of successful administrative account actions." />
    <div className="sl-admin-view">
      <Card id="sl-system-audit-log" title="System Audit Logs">
        <AuditTable />
      </Card>
    </div>
  </>;
}