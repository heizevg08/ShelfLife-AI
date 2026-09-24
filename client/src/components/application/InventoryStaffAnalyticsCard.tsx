import type { LucideIcon } from 'lucide-react';

type InventoryStaffAnalyticsItem = {
  label: string;
  series: number;
};

type InventoryStaffAnalyticsCardProps = {
  ariaLabel: string;
  centerLabel: string;
  Icon: LucideIcon;
  items: InventoryStaffAnalyticsItem[];
  title: string;
  unavailableMessage: string;
};

export function InventoryStaffAnalyticsCard({
  ariaLabel,
  centerLabel,
  Icon,
  items,
  title,
  unavailableMessage,
}: InventoryStaffAnalyticsCardProps) {
  return <section className="sl-inventory-staff-breakdown-card">
    <header className="sl-staff-usage-card-head">
      <span className="sl-staff-usage-head-icon"><Icon aria-hidden="true" /></span>
      <h2>{title}</h2>
    </header>
    <div className="sl-inventory-staff-breakdown-body" role="img" aria-label={ariaLabel}>
      <div className="sl-inventory-staff-breakdown-visual">
        <div className="sl-inventory-staff-breakdown-donut" aria-hidden="true"><strong>—</strong><span>{centerLabel}</span></div>
        <div className="sl-inventory-staff-breakdown-legend" aria-label={`${title} legend`}>
          {items.map(item => <div className="sl-inventory-staff-breakdown-legend-row" key={item.label}><i data-series={item.series} /><span>{item.label}</span><strong>—</strong></div>)}
        </div>
      </div>
      <span className="sl-inventory-staff-breakdown-note">{unavailableMessage}</span>
    </div>
  </section>;
}
