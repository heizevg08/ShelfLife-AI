import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Boxes, FileText, PackagePlus, PackageX, Plus, Search, TrendingUp } from 'lucide-react';
import { createIngredient, listIngredientCategories, listStockInIngredients, type StockInIngredient } from '../../services/ingredients';
import { createStockIn, getInventoryBatchSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary } from '../../services/inventory-batches';
import { formatDate, localDateInputValue } from '../../utils/date-time';
import { ApiError } from '../../services/apiClient';
import { Dialog } from './Dialog';
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
  const emptyState = (columns: number, description: string) => <tr><td colSpan={columns} className="sl-empty-cell"><DataState kind={failed ? 'error' : loading ? 'loading' : 'empty'} title={failed ? 'Inventory unavailable' : loading ? 'Loading inventory' : search || category || status || expiration !== 'All' ? 'No matching records' : 'No inventory records yet'} description={failed ? 'Inventory records could not be loaded.' : loading ? 'Retrieving current inventory batches.' : description} /></td></tr>;
  const fefo = [...(data?.items ?? [])].filter(batch => batch.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);

  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your inventory." actions={<><button ref={addIngredientTrigger} className="sl-button" type="button" onClick={() => { setFormError(''); setIngredientOpen(true); }}><Plus size={16} />Add Ingredient</button><button ref={stockInTrigger} className="sl-button sl-button-primary" type="button" onClick={() => { setFormError(''); setStockInOpen(true); }}><PackagePlus size={16} />Stock In</button></>} />
    <div className="sl-admin-view sl-manager-inventory-v119 sl-manager-inventory-live">
      <section className="sl-sa-kpis sl-manager-inventory-kpis sl-kpi-reference-v201" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Stock Items</span><strong>{summary?.totalBatches ?? '—'}</strong><small>{failed ? 'Inventory summary unavailable' : 'Current inventory batches'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Near Expiry ≤ 7 Days</span><strong>{summary?.nearExpiry ?? '—'}</strong><small>{failed ? 'Expiration summary unavailable' : 'Batches requiring attention'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>{summary?.lowStockItems ?? '—'}</strong><small>{failed ? 'Stock summary unavailable' : 'Items at or below minimum stock'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Inventory Value</span><strong>—</strong><small>Valuation data pending</small></div></article>
      </section>
      <section className="sl-manager-inventory-directory sl-reference-records" aria-label="Inventory records">
        <header className="sl-reference-records-heading"><span className="sl-staff-usage-head-icon"><FileText /></span><strong>Inventory Records</strong></header>
        <div className="sl-manager-inventory-filters"><label className="sl-manager-inventory-search"><span>Search</span><span className="sl-directory-search"><Search size={17}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search ingredient or batch ID..." /></span></label><label><span>Category</span><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Stock Status</span><select value={status} onChange={event => { setStatus(event.target.value as InventoryBatchDisplayStatus | ''); setPage(1); }}><option value="">All Statuses</option>{['In Stock','Low Stock','Near Expiry','Expired'].map(value => <option key={value}>{value}</option>)}</select></label><label><span>Expiration</span><select value={expiration} onChange={event => { setExpiration(event.target.value); setPage(1); }}><option>All</option><option>≤ 7 days</option><option>8–30 days</option><option>&gt; 30 days</option></select></label><div className="sl-manager-inventory-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button></div></div>
        <div className="sl-manager-inventory-table-shell"><table className="sl-data-table sl-manager-inventory-table sl-reference-records-table"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Expiration Date','Days Left','Status'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{visible.length ? visible.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" tabIndex={0} role="button" onClick={event => { detailTrigger.current = event.currentTarget; setDetail(batch); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detailTrigger.current = event.currentTarget; setDetail(batch); } }}><td className="sl-emphasized-value">{batch.ingredient.name}</td><td>{batch.batchID}</td><td>{batch.ingredient.category}</td><td>{batch.quantity} {batch.unit}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td></tr>) : emptyState(7, 'Inventory batches will appear here after stock is received.')}</tbody></table></div>
        <footer className="sl-manager-inventory-footer sl-reference-records-footer"><label>Rows per page <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={pageSize} total={data?.total ?? 0} itemLabel="inventory records" onPageChange={setPage} /></footer>
      </section>
      <div className="sl-manager-inventory-lower-grid"><section className="sl-manager-inventory-panel sl-reference-records"><header><div><strong>FEFO Priority</strong><small>Top batches to use first</small></div></header><div className="sl-manager-inventory-table-shell"><table className="sl-data-table sl-reference-records-table"><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left','Priority'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{fefo.length ? fefo.map((batch, index) => <tr key={batch.id}><td className="sl-emphasized-value">{batch.ingredient.name}</td><td>{batch.batchID}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td>{index + 1}</td></tr>) : emptyState(5, 'FEFO-priority batches will appear when inventory is available.')}</tbody></table></div></section><section className="sl-manager-inventory-panel"><header><strong>Inventory by Category</strong></header><div className="sl-manager-panel-empty"><DataState kind="empty" title="No live records yet" description="Category distribution will appear when inventory analytics are available." /><span className="sl-preview-badge">Preview · data pending</span></div></section></div>
    </div>
    <Dialog open={ingredientOpen} showClose={false} busy={busy} title="Add Ingredient" onDismiss={() => setIngredientOpen(false)} returnFocus={addIngredientTrigger} actions={<><button className="sl-button" type="button" onClick={() => setIngredientOpen(false)}>Cancel</button><button className="sl-button sl-button-primary" type="submit" form="manager-add-ingredient" disabled={busy}>Add Ingredient</button></>}><form id="manager-add-ingredient" className="sl-manager-operation-form" onSubmit={submitIngredient}>{formError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{formError}</p>}<div className="sl-form-grid"><label><span>Name</span><input value={ingredientForm.name} onChange={event => setIngredientForm(value => ({ ...value, name: event.target.value }))}/></label><label><span>Category</span><select value={ingredientForm.category} onChange={event => setIngredientForm(value => ({ ...value, category: event.target.value }))}><option value="">Select category</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Unit of Measure</span><select value={ingredientForm.unitOfMeasure} onChange={event => setIngredientForm(value => ({ ...value, unitOfMeasure: event.target.value }))}><option value="">Select unit</option>{UNITS.map(value => <option key={value}>{value}</option>)}</select></label><label><span>Minimum Stock</span><input inputMode="decimal" value={ingredientForm.minimumStock} onChange={event => setIngredientForm(value => ({ ...value, minimumStock: event.target.value }))}/></label><label><span>Standard Unit Cost</span><input inputMode="decimal" value={ingredientForm.standardUnitCost} onChange={event => setIngredientForm(value => ({ ...value, standardUnitCost: event.target.value }))}/></label><label><span>Default Shelf Life (Days)</span><input inputMode="numeric" value={ingredientForm.defaultShelfLifeDays} onChange={event => setIngredientForm(value => ({ ...value, defaultShelfLifeDays: event.target.value }))}/></label><label className="sl-manager-form-wide"><span>Description</span><textarea rows={3} value={ingredientForm.description} onChange={event => setIngredientForm(value => ({ ...value, description: event.target.value }))}/></label></div></form></Dialog>
    <Dialog open={stockInOpen} showClose={false} busy={busy} title="Stock In" onDismiss={() => setStockInOpen(false)} returnFocus={stockInTrigger} actions={<><button className="sl-button" type="button" onClick={() => setStockInOpen(false)}>Cancel</button><button className="sl-button sl-button-primary" type="submit" form="manager-stock-in" disabled={busy}>Save Stock-In</button></>}><form id="manager-stock-in" className="sl-manager-operation-form" onSubmit={submitStockIn}>{formError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{formError}</p>}<div className="sl-form-grid"><label><span>Date Received</span><input type="date" value={stockForm.dateReceived} onChange={event => setStockForm(value => ({ ...value, dateReceived: event.target.value }))}/></label><label><span>Ingredient</span><select value={stockForm.ingredientId} onChange={event => setStockForm(value => ({ ...value, ingredientId: event.target.value }))}><option value="">Select ingredient</option>{ingredients.map(value => <option value={value.id} key={value.id}>{value.name}</option>)}</select></label><label><span>Quantity Received</span><input inputMode="decimal" value={stockForm.quantity} onChange={event => setStockForm(value => ({ ...value, quantity: event.target.value }))}/></label><label><span>Unit</span><output>{ingredients.find(value => value.id === stockForm.ingredientId)?.unitOfMeasure ?? '—'}</output></label><label><span>Expiration Date</span><input type="date" min={stockForm.dateReceived || undefined} value={stockForm.expirationDate} onChange={event => setStockForm(value => ({ ...value, expirationDate: event.target.value }))}/></label><label><span>Unit Cost (Optional)</span><input inputMode="decimal" value={stockForm.unitCost} onChange={event => setStockForm(value => ({ ...value, unitCost: event.target.value }))}/></label></div></form></Dialog>
    <Dialog open={detail !== null} showClose={false} title="Inventory Batch Details" onDismiss={() => setDetail(null)} returnFocus={detailTrigger} actions={<button className="sl-button" type="button" onClick={() => setDetail(null)}>Close</button>}><dl className="sl-manager-detail-grid"><div><dt>Ingredient</dt><dd className="sl-emphasized-value">{detail?.ingredient.name}</dd></div><div><dt>Batch ID</dt><dd>{detail?.batchID}</dd></div><div><dt>Category</dt><dd>{detail?.ingredient.category}</dd></div><div><dt>Current Stock</dt><dd>{detail ? `${detail.quantity} ${detail.unit}` : '—'}</dd></div><div><dt>Date Received</dt><dd>{detail ? formatDate(detail.dateReceived) : '—'}</dd></div><div><dt>Expiration Date</dt><dd>{detail ? formatDate(detail.expirationDate) : '—'}</dd></div><div><dt>Days Left</dt><dd>{detail?.daysLeft ?? '—'}</dd></div><div><dt>Status</dt><dd>{detail?.displayStatus ?? '—'}</dd></div></dl></Dialog>
  </>;
}
