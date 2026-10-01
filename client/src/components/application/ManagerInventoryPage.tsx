import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Boxes, FileText, PackagePlus, PackageX, Plus, Search, TrendingUp } from 'lucide-react';
import { createIngredient, listIngredientCategories, listStockInIngredients, type StockInIngredient } from '../../services/ingredients';
import { createStockIn, getInventoryBatchSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary } from '../../services/inventory-batches';
import { formatDate, localDateInputValue } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApiError } from '../../services/apiClient';
import { ApplicationDonutChart } from './ApplicationPatterns';
import { InventoryBatchDetailsDialog } from './InventoryBatchDetailsDialog';
import { InventoryStaffModal, InventoryStaffModalForm } from './InventoryStaffModal';
import { DataState, PageHeader, Pagination, Status } from './primitives';

const PAGE_SIZES = [10, 15, 50, 100, 150] as const;
const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle', 'can', 'tray'] as const;

export function ConnectedManagerInventoryPage() {
  const addIngredientTrigger = useRef<HTMLButtonElement>(null);
  const stockInTrigger = useRef<HTMLButtonElement>(null);
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
  const [ingredients, setIngredients] = useState<StockInIngredient[]>([]);
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [ingredientForm, setIngredientForm] = useState({ name: '', category: '', unitOfMeasure: '', minimumStock: '', standardUnitCost: '', defaultShelfLifeDays: '', description: '' });
  const [stockForm, setStockForm] = useState({ ingredientId: '', dateReceived: localDateInputValue(new Date()), quantity: '', expirationDate: '', unitCost: '' });

  const load = (signal?: AbortSignal) => {
    setLoading(true); setFailed(false);
    return Promise.all([
      listInventoryBatches({ page, pageSize, search: search.trim() || undefined, category: category || undefined, status: status || undefined }, signal),
      getInventoryBatchSummary(signal),
      listIngredientCategories(signal),
      listStockInIngredients(signal),
    ]).then(([records, nextSummary, categoryResult, ingredientResult]) => {
      setData(records); setSummary(nextSummary); setCategories(categoryResult.categories); setIngredients(ingredientResult.ingredients);
    }).catch(error => { if ((error as Error).name !== 'AbortError') setFailed(true); }).finally(() => { if (!signal?.aborted) setLoading(false); });
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [page, pageSize, search, category, status]);

  const expirationMatches = (batch: InventoryBatch) => expiration === 'All' || expiration === '≤ 7 days' && batch.daysLeft >= 0 && batch.daysLeft <= 7 || expiration === '8–30 days' && batch.daysLeft >= 8 && batch.daysLeft <= 30 || expiration === '> 30 days' && batch.daysLeft > 30;
  const visible = data?.items.filter(expirationMatches) ?? [];
  const reset = () => { setSearch(''); setCategory(''); setStatus(''); setExpiration('All'); setPage(1); };
  const apiError = (error: unknown) => error instanceof ApiError ? error.message : 'Unable to save this record.';

  const submitIngredient = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!ingredientForm.name.trim() || !ingredientForm.category || !ingredientForm.unitOfMeasure) { setFormError('Enter the ingredient name, category, and unit of measure.'); return; }
    setBusy(true);
    try {
      await createIngredient({
        name: ingredientForm.name.trim(), brand: '', description: ingredientForm.description.trim(), category: ingredientForm.category, unitOfMeasure: ingredientForm.unitOfMeasure,
        ...(ingredientForm.minimumStock ? { minimumStock: Number(ingredientForm.minimumStock) } : {}),
        ...(ingredientForm.standardUnitCost ? { standardUnitCost: Number(ingredientForm.standardUnitCost) } : {}),
        ...(ingredientForm.defaultShelfLifeDays ? { defaultShelfLifeDays: Number(ingredientForm.defaultShelfLifeDays) } : {}),
      });
      setIngredientOpen(false); setIngredientForm({ name: '', category: '', unitOfMeasure: '', minimumStock: '', standardUnitCost: '', defaultShelfLifeDays: '', description: '' }); await load();
    } catch (error) { setFormError(apiError(error)); } finally { setBusy(false); }
  };
  const submitStockIn = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    const quantity = Number(stockForm.quantity);
    if (!stockForm.ingredientId || !stockForm.dateReceived || !stockForm.expirationDate || !Number.isFinite(quantity) || quantity <= 0) { setFormError('Select an ingredient and valid dates, then enter a quantity greater than 0.'); return; }
    setBusy(true);
    try {
      await createStockIn({ ingredientId: stockForm.ingredientId, dateReceived: stockForm.dateReceived, quantity, expirationDate: stockForm.expirationDate, ...(stockForm.unitCost ? { unitCost: Number(stockForm.unitCost) } : {}) });
      setStockInOpen(false); setStockForm({ ingredientId: '', dateReceived: localDateInputValue(new Date()), quantity: '', expirationDate: '', unitCost: '' }); await load();
    } catch (error) { setFormError(apiError(error)); } finally { setBusy(false); }
  };
  const statusTone = (value: InventoryBatchDisplayStatus) => value === 'Expired' ? 'critical' : value === 'Near Expiry' || value === 'Low Stock' ? 'attention' : 'success';
  const emptyState = (columns: number, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : loading ? 'Loading inventory' : search || category || status || expiration !== 'All' ? 'No matching records' : 'No inventory records yet'} description={failed ? 'Inventory records could not be loaded.' : loading ? 'Retrieving current inventory batches.' : description} /></td></tr>;
  const fefo = [...(data?.items ?? [])].filter(batch => batch.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);

  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your inventory." actions={<><button ref={addIngredientTrigger} className="sl-button" type="button" onClick={() => { setFormError(''); setIngredientOpen(true); }}><Plus size={16} />Add Ingredient</button><button ref={stockInTrigger} className="sl-button sl-button-primary" type="button" onClick={() => { setFormError(''); setStockInOpen(true); }}><PackagePlus size={16} />Stock In</button></>} />
    <div className="sl-admin-view sl-manager-inventory-v119 sl-manager-inventory-live">
      <section className="sl-sa-kpis sl-manager-inventory-kpis sl-kpi-reference-v201" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Stock Items</span><strong>{summary?.totalBatches ?? '—'}</strong><small>{failed ? 'Inventory summary unavailable' : summary ? 'Current inventory batches' : 'Loading inventory summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Near Expiry ≤ 7 Days</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{failed ? 'Expiration summary unavailable' : summary ? 'Batches requiring attention' : 'Loading expiration summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{failed ? 'Stock summary unavailable' : summary ? 'Items at or below minimum stock' : 'Loading stock summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Inventory Value</span><strong>{summary?.inventoryValue === null || summary?.inventoryValue === undefined ? '—' : `₱${summary.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><small>{failed ? 'Inventory valuation unavailable' : !summary ? 'Loading inventory valuation' : summary.inventoryValue === null ? 'Some batches have no authoritative unit cost' : 'Current stock at authoritative unit cost'}</small></div></article>
      </section>
      <section className="sl-manager-inventory-directory sl-application-records sl-sa-ingredients-table-card sl-sa-account-pattern-records" aria-label="Inventory records">
        <header className="sl-application-records-header sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileText /></span><h2>Inventory Records</h2></header>
        <div className="sl-application-records-filters sl-sa-ingredients-table-filters"><div className="sl-application-records-toolbar sl-sa-ingredients-filter-card sl-manager-inventory-filters"><label className="sl-application-records-search sl-sa-ingredients-search"><span>Search</span><span><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search ingredient or batch ID..." /></span></label><label><span>Category</span><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Stock Status</span><select value={status} onChange={event => { setStatus(event.target.value as InventoryBatchDisplayStatus | ''); setPage(1); }}><option value="">All Statuses</option>{['In Stock','Low Stock','Near Expiry','Expired'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>Expiration</span><select value={expiration} onChange={event => { setExpiration(event.target.value); setPage(1); }}><option>All</option><option>≤ 7 days</option><option>8–30 days</option><option>&gt; 30 days</option></select></label><div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button></div></div></div>
        <div className="sl-application-records-table-shell sl-sa-ingredients-table-scroll"><table className="sl-application-records-table sl-records-table sl-sa-ingredients-table sl-data-table sl-manager-inventory-table"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Expiration Date','Days Left','Status'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.length ? visible.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatHumanReadableText(batch.ingredient.category)}</td><td>{batch.quantity} {batch.unit}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td></tr>) : emptyState(7, 'Inventory batches will appear here after stock is received.')}</tbody></table></div>
        <footer className="sl-application-records-footer sl-records-footer sl-sa-ingredients-footer"><label>Rows per page <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={pageSize} total={data?.total ?? 0} itemLabel="inventory records" onPageChange={setPage} /></footer>
      </section>
      <div className="sl-manager-inventory-lower-grid"><section className="sl-manager-inventory-panel sl-reference-records"><header><div><strong>FEFO Priority</strong><small>Top batches to use first</small></div></header><div className="sl-manager-inventory-table-shell"><table className="sl-data-table sl-reference-records-table sl-manager-fefo-table"><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left','Priority'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{fefo.length ? fefo.map((batch, index) => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{formatHumanReadableText(batch.ingredient.name)}</td><td><span className="sl-canonical-identifier">{batch.batchID}</span></td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td>{index + 1}</td></tr>) : emptyState(5, 'FEFO-priority batches will appear when inventory is available.')}</tbody></table></div></section><section className="sl-manager-inventory-panel"><header><strong>Inventory by Category</strong></header><div className="sl-manager-panel-empty">{summary ? <ApplicationDonutChart ariaLabel="Current inventory batches by category" centerLabel="Batches" centerValue={summary.totalBatches} items={summary.categoryCounts ?? []} /> : <DataState kind={failed ? 'error' : 'loading'} title={failed ? 'Data unavailable' : 'Loading category totals'} description={failed ? 'Inventory category totals could not be loaded.' : 'Retrieving current inventory categories.'} />}</div></section></div>
    </div>
    <InventoryStaffModal open={ingredientOpen} showClose={false} busy={busy} title="Add Ingredient" subtitle="Create an ingredient master-data record." Icon={Plus} onDismiss={() => setIngredientOpen(false)} returnFocus={addIngredientTrigger}><InventoryStaffModalForm formId="manager-add-ingredient" onSubmit={submitIngredient} message={formError} secondaryLabel="Cancel" onSecondary={() => setIngredientOpen(false)} primaryLabel="Add Ingredient" PrimaryIcon={Plus} busy={busy} className="sl-manager-operation-form"><label><span>Name</span><input value={ingredientForm.name} onChange={event => setIngredientForm(value => ({ ...value, name: event.target.value }))}/></label><label><span>Category</span><select value={ingredientForm.category} onChange={event => setIngredientForm(value => ({ ...value, category: event.target.value }))}><option value="">Select category</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Unit of Measure</span><select value={ingredientForm.unitOfMeasure} onChange={event => setIngredientForm(value => ({ ...value, unitOfMeasure: event.target.value }))}><option value="">Select unit</option>{UNITS.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Minimum Stock</span><input inputMode="decimal" value={ingredientForm.minimumStock} onChange={event => setIngredientForm(value => ({ ...value, minimumStock: event.target.value }))}/></label><label><span>Standard Unit Cost</span><input inputMode="decimal" value={ingredientForm.standardUnitCost} onChange={event => setIngredientForm(value => ({ ...value, standardUnitCost: event.target.value }))}/></label><label><span>Default Shelf Life (Days)</span><input inputMode="numeric" value={ingredientForm.defaultShelfLifeDays} onChange={event => setIngredientForm(value => ({ ...value, defaultShelfLifeDays: event.target.value }))}/></label><label className="sl-staff-modal-wide"><span>Description</span><textarea rows={3} value={ingredientForm.description} onChange={event => setIngredientForm(value => ({ ...value, description: event.target.value }))}/></label></InventoryStaffModalForm></InventoryStaffModal>
    <InventoryStaffModal open={stockInOpen} showClose={false} busy={busy} title="Stock In" subtitle="Receive and record an inventory batch." Icon={PackagePlus} onDismiss={() => setStockInOpen(false)} returnFocus={stockInTrigger}><InventoryStaffModalForm formId="manager-stock-in" onSubmit={submitStockIn} message={formError} secondaryLabel="Cancel" onSecondary={() => setStockInOpen(false)} primaryLabel="Save Stock-In" PrimaryIcon={PackagePlus} busy={busy} className="sl-manager-operation-form"><label><span>Date Received</span><input type="date" value={stockForm.dateReceived} onChange={event => setStockForm(value => ({ ...value, dateReceived: event.target.value }))}/></label><label><span>Ingredient</span><select value={stockForm.ingredientId} onChange={event => setStockForm(value => ({ ...value, ingredientId: event.target.value }))}><option value="">Select ingredient</option>{ingredients.map(value => <option value={value.id} key={value.id}>{value.name}</option>)}</select></label><label><span>Quantity Received</span><input inputMode="decimal" value={stockForm.quantity} onChange={event => setStockForm(value => ({ ...value, quantity: event.target.value }))}/></label><label><span>Unit</span><output className="sl-staff-derived-unit">{ingredients.find(value => value.id === stockForm.ingredientId)?.unitOfMeasure ?? '—'}</output></label><label><span>Expiration Date</span><input type="date" min={stockForm.dateReceived || undefined} value={stockForm.expirationDate} onChange={event => setStockForm(value => ({ ...value, expirationDate: event.target.value }))}/></label><label><span>Unit Cost (Optional)</span><input inputMode="decimal" value={stockForm.unitCost} onChange={event => setStockForm(value => ({ ...value, unitCost: event.target.value }))}/></label></InventoryStaffModalForm></InventoryStaffModal>
    <InventoryBatchDetailsDialog batch={detail} onDismiss={() => setDetail(null)} returnFocus={detailTrigger} humanizeIngredient />
  </>;
}
