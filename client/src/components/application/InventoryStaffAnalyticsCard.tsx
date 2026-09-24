import type { LucideIcon } from 'lucide-react';

type InventoryStaffAnalyticsItem = {
  label: string;
  series: 1 | 2 | 3 | 4;
};

type InventoryStaffAnalyticsCardProps = {
  ariaLabel: string;
  centerLabel: string;
  className: string;
  Icon: LucideIcon;
  items: InventoryStaffAnalyticsItem[];
  title: string;
  unavailableMessage: string;
};

export function InventoryStaffAnalyticsCard({
  ariaLabel,
  centerLabel,
  className,
  Icon,
  items,
  title,
  unavailableMessage,
}: InventoryStaffAnalyticsCardProps) {
  return <section className={`${className} sl-superadmin-dashboard-v49 sl-inventory-staff-breakdown-card`}>
    <header className="sl-inventory-staff-breakdown-head">
      <span className="sl-inventory-staff-breakdown-icon"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
    </header>
    <div className="sl-inventory-staff-breakdown-body" role="img" aria-label={ariaLabel}>
      <div className="sl-inventory-staff-breakdown-visual">
        <div className="sl-sa-expiration-donut" aria-hidden="true"><strong>—</strong><span>{centerLabel}</span></div>
        <div className="sl-sa-chart-legend sl-inventory-staff-breakdown-legend" aria-label={`${title} legend`}>
          {items.map(item => <div key={item.label}><i data-series={item.series} /><span>{item.label}</span><strong>—</strong></div>)}
        </div>
      </div>
      <span className="sl-inventory-staff-breakdown-note">{unavailableMessage}</span>
    </div>
  </section>;
}
