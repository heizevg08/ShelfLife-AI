import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Boxes, FileText, PackageX, Search, TrendingUp } from 'lucide-react';
import { listIngredientCategories } from '../../services/ingredients';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary } from '../../services/inventory-batches';
import { formatDate } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApplicationDonutChart } from './ApplicationPatterns';
import { InventoryBatchDetailsDialog } from './InventoryBatchDetailsDialog';
import { DataState, PageHeader, Pagination, Status } from './primitives';

const PAGE_SIZES = [10, 15, 50, 100, 150] as const;
export function ConnectedManagerInventoryPage() {
  const detailTrigger = useRef<HTMLTableRowElement>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<InventoryBatchDisplayStatus | ''>('');
  const [expiration, setExpiration] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: InventoryBatch[]; total: number } | null>(null);
  const [summary, setSummary] = useState<InventoryBatchSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<InventoryBatch | null>(null);

  const load = (signal?: AbortSignal) => {
    setLoading(true); setFailed(false);
    return Promise.all([
      listInventoryBatches({ page, pageSize, search: search.trim() || undefined, category: category || undefined, status: status || undefined }, signal),
      getInventoryBatchSummary(signal),
      listIngredientCategories(signal),
    ]).then(([records, nextSummary, categoryResult]) => {
      setData(records); setSummary(nextSummary); setCategories(categoryResult.categories);
    }).catch(error => { if ((error as Error).name !== 'AbortError') setFailed(true); }).finally(() => { if (!signal?.aborted) setLoading(false); });
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [page, pageSize, search, category, status]);

  const expirationMatches = (batch: InventoryBatch) => expiration === 'All' || expiration === '≤ 7 days' && batch.daysLeft >= 0 && batch.daysLeft <= 7 || expiration === '8–30 days' && batch.daysLeft >= 8 && batch.daysLeft <= 30 || expiration === '> 30 days' && batch.daysLeft > 30;
  const visible = data?.items.filter(expirationMatches) ?? [];
  const reset = () => { setSearch(''); setCategory(''); setStatus(''); setExpiration('All'); setPage(1); };
  const statusTone = (value: InventoryBatchDisplayStatus) => value === 'Expired' ? 'critical' : value === 'Near Expiry' || value === 'Low Stock' ? 'attention' : 'success';
  const emptyState = (columns: number, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : loading ? 'Loading inventory' : search || category || status || expiration !== 'All' ? 'No matching records' : 'No inventory records yet'} description={failed ? 'Inventory records could not be loaded.' : loading ? 'Retrieving current inventory batches.' : description} /></td></tr>;
  const fefo = [...(data?.items ?? [])].filter(batch => batch.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);

  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your inventory." />
    <div className="sl-admin-view sl-manager-inventory-v119 sl-manager-inventory-live">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Inventory Batches</span><strong>{summary?.totalBatches ?? '—'}</strong><small>{failed ? 'Inventory summary unavailable' : summary ? 'Current inventory batches' : 'Loading inventory summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Near Expiry ≤ 7 Days</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{failed ? 'Expiration summary unavailable' : summary ? 'Batches requiring attention' : 'Loading expiration summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{failed ? 'Stock summary unavailable' : summary ? 'Items at or below minimum stock' : 'Loading stock summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Inventory Value</span><strong>{summary?.inventoryValue === null || summary?.inventoryValue === undefined ? '—' : `₱${summary.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><small>{failed ? 'Inventory valuation unavailable' : !summary ? 'Loading inventory valuation' : summary.inventoryValue === null ? 'Some batches have no authoritative unit cost' : 'Current stock at authoritative unit cost'}</small></div></article>
      </section>
      <section className="sl-manager-inventory-directory sl-application-records sl-sa-ingredients-table-card sl-sa-account-pattern-records" aria-label="Inventory records">
        <header className="sl-application-records-header sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileText /></span><h2>Inventory Records</h2></header>
        <div className="sl-application-records-filters sl-sa-ingredients-table-filters"><div className="sl-application-records-toolbar sl-sa-ingredients-filter-card" data-filter-layout="records-five"><label className="sl-application-records-search sl-sa-ingredients-search"><span>Search</span><span><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search ingredient or batch ID..." /></span></label><label><span>Category</span><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Stock Status</span><select value={status} onChange={event => { setStatus(event.target.value as InventoryBatchDisplayStatus | ''); setPage(1); }}><option value="">All Statuses</option>{['In Stock','Low Stock','Near Expiry','Expired'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>Expiration</span><select value={expiration} onChange={event => { setExpiration(event.target.value); setPage(1); }}><option>All</option><option>≤ 7 days</option><option>8–30 days</option><option>&gt; 30 days</option></select></label><div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button></div></div></div>
        <div className="sl-application-records-table-shell sl-sa-ingredients-table-scroll"><table className="sl-application-records-table sl-records-table sl-sa-ingredients-table sl-data-table"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Expiration Date','Days Left','Status'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.length ? visible.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatHumanReadableText(batch.ingredient.category)}</td><td>{batch.quantity} {batch.unit}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td></tr>) : emptyState(7, 'Inventory batches will appear here after stock is received.')}</tbody></table></div>
        <footer className="sl-application-records-footer sl-records-footer sl-sa-ingredients-footer"><label>Rows per page <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={pageSize} total={data?.total ?? 0} itemLabel="inventory records" onPageChange={setPage} /></footer>
      </section>
      <div className="sl-manager-inventory-lower-grid"><section className="sl-manager-inventory-panel sl-reference-records"><header><div><strong>FEFO Priority</strong><small>Top batches to use first</small></div></header><div className="sl-manager-inventory-table-shell"><table className="sl-application-records-table sl-data-table sl-reference-records-table"><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left','Priority'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{fefo.length ? fefo.map((batch, index) => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td>{index + 1}</td></tr>) : emptyState(5, 'FEFO-priority batches will appear when inventory is available.')}</tbody></table></div></section><section className="sl-manager-inventory-panel"><header><strong>Inventory by Category</strong></header><div className="sl-manager-panel-empty">{summary ? <ApplicationDonutChart ariaLabel="Current inventory batches by category" centerLabel="Batches" centerValue={summary.totalBatches} items={summary.categoryCounts ?? []} /> : <DataState kind={failed ? 'error' : 'loading'} title={failed ? 'Data unavailable' : 'Loading category totals'} description={failed ? 'Inventory category totals could not be loaded.' : 'Retrieving current inventory categories.'} />}</div></section></div>
    </div>
    <InventoryBatchDetailsDialog batch={detail} onDismiss={() => setDetail(null)} returnFocus={detailTrigger} humanizeIngredient />
  </>;
}
