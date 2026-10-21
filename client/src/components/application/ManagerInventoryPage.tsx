import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { AlertTriangle, Boxes, FileText, PackageX, Search, TrendingUp } from 'lucide-react';
import { INGREDIENT_CATEGORIES } from '../../services/ingredients';
import { getInventoryBatchSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary } from '../../services/inventory-batches';
import { formatDate } from '../../utils/date-time';
import { fefoUrgency } from '../../utils/fefo-urgency';
import { formatHumanReadableText } from '../../utils/display-text';
import { daysLeftRemaining } from '../../utils/days-left';
import { formatCompactPeso, formatExactPeso } from '../../utils/compact-number';
import { ApplicationDonutChart } from './ApplicationPatterns';
import { FilterSelect } from './FilterSelect';
import { InventoryBatchDetailsDialog } from './InventoryBatchDetailsDialog';
import { Card, DataState, PageHeader, Pagination, Status } from './primitives';

const PAGE_SIZES = [10, 15, 50, 100, 150] as const;
export function ConnectedManagerInventoryPage() {
  const hash = useLocation({ select: location => location.hash });
  const detailTrigger = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (hash.replace(/^#/, '') !== 'inventory-records') return;
    const frame = requestAnimationFrame(() => {
      document.getElementById('inventory-records')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<InventoryBatchDisplayStatus | ''>('');
  const [expiration, setExpiration] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: InventoryBatch[]; total: number } | null>(null);
  const [fefo, setFefo] = useState<InventoryBatch[] | null>(null);
  const [fefoFailed, setFefoFailed] = useState(false);
  const [summary, setSummary] = useState<InventoryBatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<InventoryBatch | null>(null);

  const load = (signal?: AbortSignal) => {
    setLoading(true); setFailed(false);
    return Promise.all([
      listInventoryBatches({ page, pageSize, search: search.trim() || undefined, category: category || undefined, status: status || undefined }, signal),
      getInventoryBatchSummary(signal),
    ]).then(([records, nextSummary]) => {
      setData(records); setSummary(nextSummary);
    }).catch(error => { if ((error as Error).name !== 'AbortError') setFailed(true); }).finally(() => { if (!signal?.aborted) setLoading(false); });
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [page, pageSize, search, category, status]);
  useEffect(() => {
    const controller = new AbortController();
    setFefo(null); setFefoFailed(false);
    listInventoryBatches({ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true }, controller.signal)
      .then(records => { if (!controller.signal.aborted) setFefo(records.items); })
      .catch(() => { if (!controller.signal.aborted) setFefoFailed(true); });
    return () => controller.abort();
  }, []);

  const expirationMatches = (batch: InventoryBatch) => expiration === 'All' || expiration === '≤ 7 days' && batch.daysLeft >= 0 && batch.daysLeft <= 7 || expiration === '8–30 days' && batch.daysLeft >= 8 && batch.daysLeft <= 30 || expiration === '> 30 days' && batch.daysLeft > 30;
  const visible = data?.items.filter(expirationMatches) ?? [];
  const reset = () => { setSearch(''); setCategory(''); setStatus(''); setExpiration('All'); setPage(1); };
  const statusTone = (value: InventoryBatchDisplayStatus) => value === 'Expired' ? 'critical' : value === 'Near Expiry' || value === 'Low Stock' ? 'attention' : 'success';
  const fefoReference = new Date();
  const emptyState = (columns: number, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : loading ? 'Loading inventory' : search || category || status || expiration !== 'All' ? 'No matching records' : 'No inventory records yet'} description={failed ? 'Inventory records could not be loaded.' : loading ? 'Retrieving current inventory batches.' : description} /></td></tr>;

  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your inventory." />
    <div className="sl-admin-view sl-manager-inventory-v119 sl-manager-inventory-live">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Inventory Batches</span><strong>{summary?.totalBatches ?? '—'}</strong><small>{failed ? 'Inventory unavailable' : summary ? 'Batches in inventory' : 'Loading inventory'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Near Expiry ≤ 7 Days</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{failed ? 'Expiry data unavailable' : summary ? 'Batches expiring soon' : 'Loading expiry data'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{failed ? 'Stock data unavailable' : summary ? 'Below minimum stock' : 'Loading stock data'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Inventory Value</span><strong title={summary?.inventoryValue !== null && summary?.inventoryValue !== undefined && Number.isFinite(summary.inventoryValue) ? formatExactPeso(summary.inventoryValue) : undefined}>{failed || summary?.inventoryValue === null || summary?.inventoryValue === undefined || !Number.isFinite(summary.inventoryValue) ? '—' : formatCompactPeso(summary.inventoryValue)}</strong><small>{failed ? 'Value unavailable' : !summary ? 'Loading value' : summary.inventoryValue === null ? 'Unit cost unavailable' : 'Stock valued at unit cost'}</small></div></article>
      </section>
        <div className="sl-manager-inventory-lower-grid"><section className="sl-manager-inventory-panel sl-reference-records"><header><div><strong>FEFO Priority</strong><small>Top batches to use first</small></div></header><div className="sl-manager-inventory-table-shell"><table className="sl-application-records-table sl-data-table sl-reference-records-table sl-manager-fefo-table"><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left','Priority'].map(value => <th key={value} scope="col">{value}</th>)}</tr></thead><tbody>{fefo?.length ? fefo.map(batch => { const urgency = fefoUrgency(batch.expirationDate, fefoReference); return <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatDate(batch.expirationDate)}</td><td>{daysLeftRemaining(batch.daysLeft)}</td><td>{urgency ? <Status tone={urgency.tone}>{urgency.label}</Status> : '—'}</td></tr>; }) : <tr><td colSpan={5} className="sl-empty-cell"><DataState kind={fefoFailed ? 'error' : fefo === null ? 'loading' : 'empty'} title={fefoFailed ? 'Data unavailable' : fefo === null ? 'Loading FEFO priority' : 'No eligible batches'} description={fefoFailed ? 'FEFO-priority batches could not be loaded.' : fefo === null ? 'Retrieving eligible inventory batches.' : 'FEFO-priority batches will appear when eligible stock is available.'} /></td></tr>}</tbody></table></div></section><Card id="manager-inventory-category" title="Inventory by Category"><div className="sl-manager-panel-empty">{summary ? <ApplicationDonutChart ariaLabel="Current inventory batches by category" centerLabel="Batches" centerValue={summary.totalBatches} items={summary.categoryCounts ?? []} /> : <DataState kind={failed ? 'error' : 'loading'} title={failed ? 'Data unavailable' : 'Loading category totals'} description={failed ? 'Inventory category totals could not be loaded.' : 'Retrieving current inventory categories.'} />}</div></Card></div>
      <section id="inventory-records" className="sl-manager-inventory-directory sl-application-records sl-sa-ingredients-table-card sl-sa-account-pattern-records" aria-label="Inventory records" style={{ scrollMarginTop: 'calc(var(--sl-topbar-height) + 1rem)' }}>
        <header className="sl-application-records-header sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileText /></span><h2>Inventory Records</h2></header>
        <div className="sl-application-records-filters sl-sa-ingredients-table-filters"><div className="sl-application-records-toolbar sl-sa-ingredients-filter-card" data-filter-layout="records-five"><label className="sl-application-records-search sl-sa-ingredients-search"><span>Search</span><span><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search ingredient or batch ID..." maxLength={100} /></span></label><label><span>Category</span><FilterSelect ariaLabel="Filter inventory by category" value={category} options={[{value:'',label:'All Categories'},...INGREDIENT_CATEGORIES.map(value => ({value, label:value}))]} onChange={value => { setCategory(value); setPage(1); }}/></label><label><span>Stock Status</span><FilterSelect ariaLabel="Filter inventory by stock status" value={status} options={[{value:'',label:'All Statuses'},...['In Stock','Low Stock','Near Expiry','Expired'].map(value => ({value, label: value}))]} onChange={value => { setStatus(value as InventoryBatchDisplayStatus | ''); setPage(1); }}/></label><label><span>Expiration</span><FilterSelect ariaLabel="Filter inventory by expiration" value={expiration} options={['All','≤ 7 days','8–30 days','> 30 days'].map(value => ({value, label: value}))} onChange={value => { setExpiration(value); setPage(1); }}/></label><div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button></div></div></div>
        <div className="sl-application-records-table-shell sl-sa-ingredients-table-scroll"><table className="sl-application-records-table sl-records-table sl-sa-ingredients-table sl-data-table"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Expiration Date','Days Left','Status'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.length ? visible.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatHumanReadableText(batch.ingredient.category)}</td><td>{batch.quantity} {batch.unit}</td><td>{formatDate(batch.expirationDate)}</td><td>{daysLeftRemaining(batch.daysLeft)}</td><td><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td></tr>) : emptyState(7, 'Inventory batches will appear here after stock is received.')}</tbody></table></div>
        <footer className="sl-application-records-footer sl-records-footer sl-sa-ingredients-footer"><label>Rows per page <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={pageSize} total={data?.total ?? 0} itemLabel="inventory records" onPageChange={setPage} /></footer>
      </section>
    </div>
    <InventoryBatchDetailsDialog batch={detail} onDismiss={() => setDetail(null)} returnFocus={detailTrigger} />
  </>;
}
