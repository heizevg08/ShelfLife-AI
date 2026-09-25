import type { LucideIcon } from 'lucide-react';
import { ApplicationDonutChart } from './ApplicationPatterns';

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
    <ApplicationDonutChart ariaLabel={ariaLabel} centerLabel={centerLabel} items={items.map(item => item.label)} unavailableMessage={unavailableMessage} />
  </section>;
}
