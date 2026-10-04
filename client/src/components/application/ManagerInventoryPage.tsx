import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Boxes, PackageX, PhilippinePeso } from 'lucide-react';
import { stockInIngredientOptions } from '../../services/ingredients';
import { inventoryBatchSummary, listInventoryBatches, type InventoryBatchSummary } from '../../services/inventoryBatches';
import { adaptInventoryBatch, formatDecimal, formatPhp, statusTone, type ManagerInventoryBatch } from '../../services/inventoryManagerAdapter';
import { Card, DataState, PageHeader, Pagination, Status } from './primitives';
import { InventoryBatchDetailsDialog } from './InventoryBatchDetailsDialog';

const PAGE_SIZE = 25;

export function ManagerInventoryPage() {
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<InventoryBatchSummary | null>(null);
  const [items, setItems] = useState<ManagerInventoryBatch[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<ManagerInventoryBatch | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setFailed(false);
    Promise.all([listInventoryBatches(page, PAGE_SIZE, abort.signal), stockInIngredientOptions(abort.signal), inventoryBatchSummary(abort.signal)])
      .then(([batches, ingredients, nextSummary]) => {
        if (abort.signal.aborted) return;
        setItems(batches.items.map(batch => adaptInventoryBatch(batch, ingredients.ingredients)));
        setTotal(batches.total); setSummary(nextSummary);
      }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [page]);

  const state = failed ? <DataState kind="error" title="Inventory could not be loaded" description="Check connectivity and retry." />
    : !items ? <DataState kind="loading" title="Loading inventory" description="Retrieving active inventory batches." />
      : items.length === 0 ? <DataState kind="empty" title="No active inventory batches" description="Archived batches are excluded from this view." /> : null;
  const fefo = [...(items ?? [])].filter(batch => batch.daysLeft >= 0).sort((left, right) => left.expirationDate.localeCompare(right.expirationDate) || left.dateReceived.localeCompare(right.dateReceived) || left.id.localeCompare(right.id)).slice(0, 5);
  return <main className="sl-admin-view"><PageHeader eyebrow="Inventory" title="Inventory" description="Review active batches in FEFO order. Stock-in and bulk actions are not part of this read-only view." />
    <section className="sl-sa-kpis" aria-label="Inventory summary">
      <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Active batches</span><strong>{summary?.totalBatches ?? '—'}</strong><small>{failed ? 'Inventory summary unavailable' : 'Active records only'}</small></div></article>
      <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Approaching expiry</span><strong>{summary ? summary.statusCounts['Approaching Expiry'] + summary.statusCounts.Critical : '—'}</strong><small>Approaching or critical thresholds</small></div></article>
      <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low stock items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{summary?.lowStockExcludedCount ? `${summary.lowStockExcludedCount} threshold${summary.lowStockExcludedCount === 1 ? '' : 's'} unavailable` : 'Eligible on-hand quantities only'}</small></div></article>
      <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><PhilippinePeso /></span><div><span>Inventory value</span><strong>{summary ? formatPhp(summary.inventoryValue) : '—'}</strong><small>PHP total, rounded once at final sum</small></div></article>
    </section>
    <Card id="manager-inventory-records" title="Inventory records"><div className="sl-table-scroll" role="region" aria-label="Inventory records" tabIndex={0}><table className="sl-data-table"><thead><tr><th>Ingredient</th><th>Batch code</th><th>Category</th><th>Current stock</th><th>Expiration</th><th>Days left</th><th>Status</th></tr></thead><tbody>{state ? <tr><td colSpan={7}>{state}</td></tr> : items!.map(batch => <tr key={batch.id} tabIndex={0} className="sl-detail-enabled-row" onClick={event => { trigger.current = event.currentTarget; setSelected(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); trigger.current = event.currentTarget; setSelected(batch); } }}><td>{batch.ingredient?.name ?? 'Archived or unavailable ingredient'}</td><td>{batch.batchCode}</td><td>{batch.ingredient?.category ?? '—'}</td><td>{formatDecimal(batch.quantity)} {batch.unit}</td><td>{batch.expirationDate}</td><td>{batch.daysLeft}</td><td><Status tone={statusTone(batch.status)}>{batch.status}</Status></td></tr>)}</tbody></table></div><Pagination page={page} pageSize={PAGE_SIZE} total={total} itemLabel="inventory batches" onPageChange={setPage} /></Card>
    <section className="sl-module-columns"><Card id="manager-inventory-fefo" title="FEFO priority"><div className="sl-table-scroll"><table className="sl-data-table"><thead><tr><th>Ingredient</th><th>Batch code</th><th>Expiration</th><th>Days left</th></tr></thead><tbody>{fefo.length ? fefo.map(batch => <tr key={batch.id}><td>{batch.ingredient?.name ?? 'Unavailable ingredient'}</td><td>{batch.batchCode}</td><td>{batch.expirationDate}</td><td>{batch.daysLeft}</td></tr>) : <tr><td colSpan={4}>No non-expired active batches.</td></tr>}</tbody></table></div></Card><Card id="manager-inventory-category" title="Inventory by category"><div className="sl-table-scroll"><table className="sl-data-table"><thead><tr><th>Category</th><th>Batches</th><th>Quantity</th><th>Value</th></tr></thead><tbody>{summary?.categoryCounts.map(category => <tr key={category.category}><td>{category.category}</td><td>{category.batchCount}</td><td>{formatDecimal(category.quantity)}</td><td>{formatPhp(category.inventoryValue)}</td></tr>) ?? <tr><td colSpan={4}>Loading category totals.</td></tr>}</tbody></table></div></Card></section>
    <InventoryBatchDetailsDialog batch={selected} onDismiss={() => setSelected(null)} returnFocus={trigger} />
  </main>;
}
