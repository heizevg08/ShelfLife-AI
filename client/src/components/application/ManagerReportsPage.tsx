import { useEffect, useState } from 'react';
import { AlertTriangle, PhilippinePeso, Trash2, TrendingUp } from 'lucide-react';
import { getInventoryBatchSummary, type InventoryBatchSummary } from '../../services/inventory-batches';
import { getWasteSummary, type WasteSummary } from '../../services/waste-records';
import { ApplicationPendingState } from './ApplicationPatterns';
import { Card, PageHeader } from './primitives';

export function ConnectedManagerReportsPage() {
  const [inventory, setInventory] = useState<InventoryBatchSummary | null>(null);
  const [waste, setWaste] = useState<WasteSummary | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [wasteError, setWasteError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getInventoryBatchSummary(controller.signal).then(setInventory).catch(error => { if ((error as Error).name !== 'AbortError') setInventoryError(true); });
    getWasteSummary(controller.signal).then(setWaste).catch(error => { if ((error as Error).name !== 'AbortError') setWasteError(true); });
    return () => controller.abort();
  }, []);
  const analytics = [
    ['manager-reports-movement', 'Inventory Movement Trend', 'Inventory movement trends will appear when authoritative inventory transaction history is available.'],
    ['manager-reports-expiration-risk', 'Expiration Risk Distribution', 'Expiration-risk analytics will appear when historical inventory batch data is available.'],
    ['manager-reports-usage-waste', 'Usage & Waste Overview', 'Usage and waste analytics will appear when authoritative transaction history aggregation is available.'],
  ] as const;
  const inventoryValue = inventory?.inventoryValue === null || inventory?.inventoryValue === undefined ? '—' : `₱${inventory.inventoryValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  return <><PageHeader eyebrow="Intelligence" title="Reports & Analytics" description="Review consolidated inventory, usage, waste, expiration, and forecasting analytics." />
    <div className="sl-admin-view sl-manager-reports-v139 sl-manager-reports-live">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Cross-domain analytics summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso/></span><div><span>Inventory Value</span><strong>{inventoryError?'—':inventoryValue}</strong><small>{inventoryError?'Inventory valuation unavailable':!inventory?'Loading inventory valuation':inventory.inventoryValue===null?'Some batches lack authoritative unit cost':'Current authoritative inventory value'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle/></span><div><span>Near-Expiry Batches</span><strong>{inventoryError?'—':inventory?.nearExpiry??'—'}</strong><small>{inventoryError?'Expiration summary unavailable':inventory?'Batches within the canonical near-expiry window':'Loading expiration summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Estimated Waste Cost</span><strong>{wasteError?'—':waste?`₱${waste.totalWasteCostToday.toFixed(2)}`:'—'}</strong><small>{wasteError?'Waste-cost summary unavailable':waste?'Authoritative waste cost recorded today':'Loading waste-cost summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp/></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Forecast data pending</small></div></article>
      </section>
      <section className="sl-manager-reports-three" aria-label="Cross-domain analytics">{analytics.map(([id,title,description])=><Card id={id} key={id} title={title}><ApplicationPendingState description={description}/></Card>)}</section>
    </div>
  </>;
}
