'use client';

import { Card, PageHeader, Status } from '../../components/application/primitives';

export default function SystemSettings() {
  return (
    <div className="sl-admin-view sl-superadmin-surface sl-system-settings-v74" data-ui-version="v308-system-settings-purpose-correction">
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="View system configuration availability and implementation status."
      />

      {/* ONE compact container, per the owner's purpose correction: the central
          overview of ShelfLifeAI's system-wide configuration areas. Each row is
          a verified implementation status — the fixed server rules are existing
          code (expiry classification, per-ingredient minimum stock, code-defined
          waste reasons, application-enforced RBAC, transactional audit records),
          while Forecasting and Notifications are deferred because no approved
          backend contract exists yet. Operational transactions remain in their
          respective modules; nothing here is editable and no backend call is
          made. The shared Status chips distinguish implemented fixed rules from
          deferred configuration capability. */}
      <Card id="system-configuration-overview" title="System Configuration Overview">
        <dl className="sl-guidance-list">
          <div>
            <dt>Inventory Policies</dt>
            <dd>Fixed server rules: seven-day near-expiry window; per-ingredient minimum stock.</dd>
            <dd><Status tone="success">Implemented</Status></dd>
          </div>
          <div>
            <dt>Waste Management</dt>
            <dd>Fixed server rules: code-defined waste reasons on immutable records.</dd>
            <dd><Status tone="success">Implemented</Status></dd>
          </div>
          <div>
            <dt>Forecasting</dt>
            <dd>Awaiting the approved ML forecasting service.</dd>
            <dd><Status tone="attention">Deferred</Status></dd>
          </div>
          <div>
            <dt>Notifications</dt>
            <dd>Awaiting a verified alert-delivery backend.</dd>
            <dd><Status tone="attention">Deferred</Status></dd>
          </div>
          <div>
            <dt>Security &amp; Access</dt>
            <dd>Fixed application-enforced RBAC: four canonical roles; System Settings is Super-Admin-only.</dd>
            <dd><Status tone="success">Implemented</Status></dd>
          </div>
          <div>
            <dt>Audit &amp; Reporting</dt>
            <dd>Active backend audit records; retention not configured.</dd>
            <dd><Status tone="success">Active</Status></dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
