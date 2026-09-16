import { Link, type Href } from 'expo-router';
import { ArrowRight, Eye, FileInput, Filter, Info, Plus, Search, PackagePlus, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountsTable } from './AccountsTable';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { moduleContent, previewFields, type PreviewId } from './module-content';
import { Card, DataState, PageHeader, Pagination, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from './primitives';
import { modules, type ModuleId } from './workspace';
import { accountSummary } from '../../services/administration';
import { ApiError } from '../../services/apiClient';
import { createIngredient, deleteIngredient, listIngredients, updateIngredient, type Ingredient, type IngredientInput } from '../../services/ingredients';


const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;
const INGREDIENT_UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle', 'can', 'tray'] as const;
type IngredientDraft = { name: string; brand: string; category: string; unit: string; minStock: string; unitCost: string; shelfLife: string; description: string };
const emptyIngredient: IngredientDraft = { name:'', brand:'', category:'', unit:'', minStock:'', unitCost:'', shelfLife:'', description:'' };
type IngredientField = keyof IngredientDraft;
const ingredientApiField: Record<string, IngredientField | undefined> = { name: 'name', brand: 'brand', category: 'category', unitOfMeasure: 'unit', minimumStock: 'minStock', standardUnitCost: 'unitCost', defaultShelfLifeDays: 'shelfLife', description: 'description' };

function IngredientForm({ form, errors, busy, formError, set, setError, onSubmit }: { form: IngredientDraft; errors: Partial<Record<IngredientField, string>>; busy: boolean; formError: string; set: (key: IngredientField, value: string) => void; setError: (key: IngredientField, value?: string) => void; onSubmit: (event: FormEvent) => void }) {
  const field = (key: IngredientField, label: string, control: React.ReactNode, required = true) => <label>{label}{required && <span className="sl-required-mark"> *</span>}{control}{errors[key] && <span id={`ingredient-${key}-error`} className="sl-field-error">{errors[key]}</span>}</label>;
  const validation = (key: IngredientField) => ({ 'aria-invalid': errors[key] ? true as const : undefined, 'aria-describedby': errors[key] ? `ingredient-${key}-error` : undefined });
  const numericChange = (key: 'minStock' | 'unitCost' | 'shelfLife', label: string, whole = false) => (value: string) => {
    set(key, value);
    if (!value) { setError(key); return; }
    const valid = whole ? /^\d+$/.test(value) : /^\d*(?:\.\d*)?$/.test(value);
    setError(key, valid ? undefined : whole ? `${label} accepts whole numbers only.` : `${label} accepts numbers only.`);
  };
  return <form id="sl-ingredient-form" className="sl-preview sl-live-ingredient-form" noValidate onSubmit={onSubmit}>
    {formError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{formError}</p>}
    <div className="sl-form-grid">
      {field('name', 'Name', <input autoFocus disabled={busy} className="sl-admin-input" placeholder="e.g. Chicken Breast" value={form.name} onChange={e => set('name', e.target.value)} {...validation('name')} />)}
      {field('brand', 'Brand', <input disabled={busy} className="sl-admin-input" placeholder="e.g. FreshFarm" value={form.brand} onChange={e => set('brand', e.target.value)} {...validation('brand')} />)}
      {field('category', 'Category', <select disabled={busy} className="sl-admin-input" value={form.category} onChange={e => set('category', e.target.value)} {...validation('category')}><option value="">Select category</option>{INGREDIENT_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select>)}
      {field('unit', 'Unit of measure', <select disabled={busy} className="sl-admin-input" value={form.unit} onChange={e => set('unit', e.target.value)} {...validation('unit')}><option value="">Select unit</option>{INGREDIENT_UNITS.map(value => <option key={value} value={value}>{value}</option>)}</select>)}
      {field('minStock', 'Minimum stock', <input id="ingredient-minStock-input" disabled={busy} className="sl-admin-input" type="text" inputMode="decimal" value={form.minStock} onChange={e => numericChange('minStock', 'Minimum stock')(e.target.value)} {...validation('minStock')} />)}
      {field('unitCost', 'Standard unit cost', <span className="sl-currency-input"><span aria-hidden="true">₱</span><input id="ingredient-unitCost-input" disabled={busy} className="sl-admin-input sl-currency-value" type="text" inputMode="decimal" value={form.unitCost === '' ? '' : (/^\d+(?:\.\d{0,2})?$/.test(form.unitCost) ? Number(form.unitCost).toFixed(2) : form.unitCost)} onFocus={e => { if (/^\d+(?:\.\d{1,2})?$/.test(form.unitCost)) e.currentTarget.select(); }} onChange={e => { const raw=e.target.value.replace(/^₱\s*/, ''); const stripped=raw.replace(/,/g,''); set('unitCost', stripped); if (!stripped) setError('unitCost'); else setError('unitCost', /^\d*(?:\.\d{0,2})?$/.test(stripped) ? undefined : 'Standard unit cost accepts numbers only.'); }} {...validation('unitCost')} /></span>)}
      {field('shelfLife', 'Default shelf life (days)', <input id="ingredient-shelfLife-input" disabled={busy} className="sl-admin-input" type="text" inputMode="numeric" value={form.shelfLife} onChange={e => numericChange('shelfLife', 'Shelf life', true)(e.target.value)} {...validation('shelfLife')} />)}
      {field('description', 'Description', <input disabled={busy} className="sl-admin-input" placeholder="e.g. Boneless, skinless chicken breast" value={form.description} onChange={e => set('description', e.target.value)} {...validation('description')} />)}
    </div>
  </form>;
}

export function WorkspaceLink({ to, children, primary = false }: { to: string; children: React.ReactNode; primary?: boolean }) {
  return <Link href={to as Href} className={`sl-button${primary ? ' sl-button-primary' : ''}`}>{children}</Link>;
}
export function ForecastFlow() {
  return <section className="sl-forecast-flow" aria-label="Forecasting workflow">
    {['Historical usage', 'Current stock & expiry', 'Demand forecast', 'Expiration risk', 'Recommended actions'].map((label, index) => <div key={label}>
      {index > 0 && <ArrowRight size={16} aria-hidden="true" />}<span>{label}</span>
    </div>)}
  </section>;
}
function FormPreview({ id }: { id: PreviewId }) {
  return <div className="sl-preview">
    <p className="sl-inline-notice"><Info size={18} aria-hidden="true" />Form preview only. Entry and saving will become available when the required records are connected.</p>
    <fieldset disabled className="sl-form-grid"><legend className="sl-sr-only">Unavailable {id} form</legend>
      {previewFields[id].map(label => <label key={label}>{label}<input className="sl-admin-input" /></label>)}
    </fieldset>
    {(id === 'Usage' || id === 'Waste') && <p className="sl-supporting">Recorded by your authenticated account. Available quantity and batch eligibility are validated before saving.</p>}
  </div>;
}

function IngredientsAdminPage({ preview, setPreview }: { preview: PreviewId | null; setPreview: (value: PreviewId | null) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: Ingredient[]; page: number; pageSize: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<IngredientDraft>(emptyIngredient);
  const [errors, setErrors] = useState<Partial<Record<IngredientField, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [successIngredient, setSuccessIngredient] = useState<Ingredient | null>(null);
  const [viewIngredient, setViewIngredient] = useState<Ingredient | null>(null);
  const [editIngredient, setEditIngredient] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setCategoryOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadError(false);
      listIngredients(page, 25, search.trim(), category === 'All' ? '' : category, abort.signal).then(value => {
        if (!abort.signal.aborted) setData(value);
      }).catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    }, 250);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [page, search, category, refresh]);
  const setField = (key: IngredientField, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setFormError('');
  };
  const setFieldError = (key: IngredientField, value?: string) => setErrors(current => ({ ...current, [key]: value }));
  const dismiss = () => { if (!busy) setPreview(null); };
  const open = () => { setEditIngredient(null); setForm(emptyIngredient); setErrors({}); setFormError(''); setPreview('Ingredients'); };
  const openEdit = (item: Ingredient) => { setEditIngredient(item); setForm({ name:item.name, brand:item.brand || '', category:item.category, unit:item.unitOfMeasure, minStock:item.minimumStock === undefined ? '' : String(item.minimumStock), unitCost:item.standardUnitCost === undefined ? '' : String(item.standardUnitCost), shelfLife:item.defaultShelfLifeDays === undefined ? '' : String(item.defaultShelfLifeDays), description:item.description || '' }); setErrors({}); setFormError(''); setPreview('Ingredients'); };
  const removeIngredient = async () => { if (!deleteTarget || actionBusy) return; setActionBusy(true); setDeleteError(''); try { await deleteIngredient(deleteTarget.id); setDeleteTarget(null); setRefresh(value => value + 1); } catch (error) { setDeleteError(error instanceof ApiError ? error.message : 'The ingredient could not be removed. Check your connection and try again.'); } finally { setActionBusy(false); } };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const next: Partial<Record<IngredientField, string>> = {};
    const clean = { ...form, name: form.name.trim().replace(/\s+/g, ' '), brand: form.brand.trim().replace(/\s+/g, ' '), unit: form.unit.trim().replace(/\s+/g, ' '), description: form.description.trim().replace(/\s+/g, ' ') };
    if (!clean.name) next.name = 'Enter an ingredient name.';
    if (!clean.category) next.category = 'Select a category.';
    if (!clean.unit) next.unit = 'Enter a unit of measure.';
    for (const [key, label] of [['minStock', 'Minimum stock'], ['unitCost', 'Standard unit cost']] as const) if (clean[key] !== '' && (!Number.isFinite(Number(clean[key])) || Number(clean[key]) < 0)) next[key] = `${label} must be 0 or greater.`;
    if (clean.shelfLife !== '' && (!Number.isInteger(Number(clean.shelfLife)) || Number(clean.shelfLife) < 1)) next.shelfLife = 'Shelf life must be a whole number of at least 1 day.';
    if (Object.keys(next).length) {
      setErrors(next);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#sl-ingredient-form [aria-invalid="true"]')?.focus());
      return;
    }
    const input: IngredientInput = { name: clean.name, brand: clean.brand, description: clean.description, category: clean.category, unitOfMeasure: clean.unit, ...(clean.minStock === '' ? {} : { minimumStock: Number(clean.minStock) }), ...(clean.unitCost === '' ? {} : { standardUnitCost: Number(clean.unitCost) }), ...(clean.shelfLife === '' ? {} : { defaultShelfLifeDays: Number(clean.shelfLife) }) };
    setBusy(true); setErrors({}); setFormError('');
    try {
      const result = editIngredient ? await updateIngredient(editIngredient.id, input) : await createIngredient(input);
      setMessage('');
      setSuccessIngredient(result.ingredient);
      setEditIngredient(null);
      setPage(1); setRefresh(value => value + 1); setPreview(null); setForm(emptyIngredient);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors: Partial<Record<IngredientField, string>> = {};
        for (const detail of error.details) { const key = ingredientApiField[detail.field]; if (key) fieldErrors[key] = detail.message; }
        setErrors(fieldErrors); setFormError(Object.keys(fieldErrors).length ? 'Check the highlighted fields.' : error.message);
      } else setFormError('The ingredient could not be saved. Check your connection and try again.');
    } finally { setBusy(false); }
  };
  return <>
    <div className="sl-ingredients-master-heading">
      <PageHeader title="Ingredients" description="Manage ingredient master data. Add, edit, or remove ingredients used in your establishment." />
      <button ref={addButtonRef} className="sl-button sl-button-primary" type="button" onClick={open}><Plus size={16} aria-hidden="true" />Add Ingredient</button>
    </div>
    <div className="sl-admin-view sl-ingredients-master-view">
      <SummaryCards items={[
        { label:'Total Ingredients', value:data ? data.total.toLocaleString() : (loadError ? 'Unavailable' : '—'), detail:'Registered ingredient records', tone:'success', trend:'line' },
        { label:'Categories', value:'—', detail:'Category aggregate not connected', tone:'brand', trend:'segments' },
        { label:'Low Stock Ingredients', value:'—', detail:'Requires live batch quantities', tone:'critical', trend:'bars' },
        { label:'Archived Ingredients', value:'—', detail:'Archive state is not in the current ingredient schema', tone:'attention', trend:'segments' },
      ]} />
      <section className="sl-ingredients-master-table" aria-label="Ingredients">
        <div className="sl-ingredient-list-toolbar"><strong>Ingredient List</strong><div className="sl-ingredients-master-tools"><div className="sl-filter-menu" ref={menuRef}><button className="sl-button" type="button" aria-haspopup="menu" aria-expanded={categoryOpen} onClick={() => setCategoryOpen(value => !value)}><Filter size={16} aria-hidden="true" />{category === 'All' ? 'All Categories' : category}</button>{categoryOpen && <div className="sl-filter-popover" role="menu">{['All', ...INGREDIENT_CATEGORIES].map(value => <button key={value} type="button" role="menuitemradio" aria-checked={category === value} onClick={() => { setCategory(value); setPage(1); setCategoryOpen(false); }}>{value === 'All' ? 'All categories' : value}</button>)}</div>}</div><div className="sl-directory-search" role="search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search ingredients..." aria-label="Search ingredients" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div></div></div>
        {loadError ? <DataState kind="error" title="Ingredients could not be loaded" description="Check your connection and try again." action={<button type="button" className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /> : !data ? <DataState kind="loading" title="Loading ingredients" description="" /> : <div className="sl-table-scroll"><table className="sl-data-table"><thead><tr>{['Name','Brand','Category','Unit','Min Stock','Unit Cost','Shelf Life','Created By','Actions'].map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{data.items.length ? data.items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.brand || '—'}</td><td><Status>{item.category}</Status></td><td>{item.unitOfMeasure}</td><td>{item.minimumStock ?? '—'}</td><td>{item.standardUnitCost === undefined ? '—' : `₱${item.standardUnitCost.toFixed(2)}`}</td><td>{item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : '—'}</td><td>{item.createdBy.name}</td><td><div className="sl-row-actions sl-account-actions sl-ingredient-actions"><button type="button" className="sl-button sl-account-action sl-account-action-view" onClick={() => setViewIngredient(item)}><Eye size={15} aria-hidden="true" />View</button><button type="button" className="sl-button sl-account-action" onClick={() => openEdit(item)}><Pencil size={15} aria-hidden="true" />Edit</button><button type="button" className="sl-button sl-account-action sl-account-action-danger" onClick={() => { setDeleteError(''); setDeleteTarget(item); }}><Trash2 size={15} aria-hidden="true" />Delete</button></div></td></tr>) : <tr><td colSpan={9} className="sl-empty-table-message">{search || category !== 'All' ? 'No ingredients match the selected filters.' : 'No live ingredient records yet — add an ingredient to begin.'}</td></tr>}</tbody></table></div>}
      </section>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} itemLabel="ingredients" onPageChange={setPage} />}
    </div>
    <Dialog
      open={preview === 'Ingredients'}
      title={<span className="sl-ingredient-reference-title">{editIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}</span>}
      onDismiss={dismiss}
      returnFocus={addButtonRef}
      busy={busy}
      className="sl-add-user-dialog sl-ingredient-reference-dialog"
      actions={<><button className="sl-button" type="button" disabled={busy} onClick={dismiss}>Cancel</button><button className="sl-button sl-button-primary" type="submit" form="sl-ingredient-form" disabled={busy}>{busy ? 'Saving…' : editIngredient ? 'Update Ingredient' : 'Save Ingredient'}</button></>}
    ><IngredientForm form={form} errors={errors} busy={busy} formError={formError} set={setField} setError={setFieldError} onSubmit={save} /></Dialog>
    <Dialog open={!!successIngredient} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon sl-success-dialog-icon">✓</span><span><span className="sl-account-dialog-title">Ingredient saved successfully</span><small>The ingredient record is now up to date in the registered ingredient list.</small></span></span>} onDismiss={() => setSuccessIngredient(null)} className="sl-add-user-dialog sl-account-reference-dialog sl-ingredient-success-dialog" actions={<button className="sl-button sl-button-primary" type="button" onClick={() => setSuccessIngredient(null)}>Done</button>}>
      {successIngredient && <div className="sl-success-summary"><strong>{successIngredient.name}</strong><span>{successIngredient.category} · {successIngredient.unitOfMeasure}</span></div>}
    </Dialog>
    <Dialog open={!!deleteTarget} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon sl-delete-warning-icon">!</span><span><span className="sl-account-dialog-title">Remove this ingredient?</span></span></span>} onDismiss={() => { if (!actionBusy) setDeleteTarget(null); }} busy={actionBusy} className="sl-add-user-dialog sl-account-reference-dialog sl-ingredient-delete-dialog" actions={<><button className="sl-button sl-delete-keep-button" type="button" disabled={actionBusy} onClick={() => setDeleteTarget(null)}>Keep this ingredient</button><button className="sl-button sl-button-danger sl-delete-confirm-button" type="button" disabled={actionBusy} onClick={removeIngredient}><Trash2 size={15} aria-hidden="true" />{actionBusy ? 'Removing…' : 'Yes, remove it'}</button></>}>
      {deleteTarget && <div className="sl-delete-reference-body">{deleteError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{deleteError}</p>}<div className="sl-delete-ingredient-card"><span className="sl-delete-ingredient-avatar">{deleteTarget.name.trim().charAt(0).toUpperCase()}</span><span><strong>{deleteTarget.name}</strong><small>{deleteTarget.category} · {deleteTarget.unitOfMeasure}</small></span></div></div>}
    </Dialog>
    <Dialog open={!!viewIngredient} title={<span className="sl-ingredient-reference-title">Ingredient Details</span>} onDismiss={() => setViewIngredient(null)} className="sl-add-user-dialog sl-account-reference-dialog sl-ingredient-view-dialog">
      {viewIngredient && <div className="sl-ingredient-detail-reference">
        <div className="sl-ingredient-detail-hero sl-ingredient-detail-no-photo">
          <span className="sl-ingredient-detail-copy"><span className="sl-ingredient-name-row"><strong>{viewIngredient.name}</strong><Status>Active</Status></span><small>{viewIngredient.category} · {viewIngredient.brand || 'No brand specified'}</small>{viewIngredient.description && <small>{viewIngredient.description}</small>}</span>
          <div className="sl-ingredient-detail-actions"><button type="button" className="sl-button" onClick={() => { const item=viewIngredient; setViewIngredient(null); openEdit(item); }}><Pencil size={15} aria-hidden="true" /> Edit</button><button type="button" className="sl-icon-button" aria-label="More ingredient actions"><MoreVertical size={18} aria-hidden="true" /></button></div>
        </div>
        <div className="sl-detail-grid"><span><small>Unit of Measure</small><strong>{viewIngredient.unitOfMeasure}</strong></span><span><small>Minimum Stock Level</small><strong>{viewIngredient.minimumStock ?? '—'} {viewIngredient.unitOfMeasure}</strong></span><span><small>Standard Unit Cost</small><strong>{viewIngredient.standardUnitCost === undefined ? '—' : `₱${viewIngredient.standardUnitCost.toFixed(2)} / ${viewIngredient.unitOfMeasure}`}</strong></span><span><small>Default Shelf Life</small><strong>{viewIngredient.defaultShelfLifeDays ? `${viewIngredient.defaultShelfLifeDays} days` : '—'}</strong></span></div>
        <section className="sl-ingredient-statistics"><h4>Statistics</h4><div className="sl-ingredient-stat-grid"><span><small>Total Batches</small><strong>—</strong></span><span><small>Current Stock</small><strong>—</strong></span><span><small>Total Used (This Month)</small><strong>—</strong></span><span><small>Total Waste (This Month)</small><strong>—</strong></span></div><p className="sl-sr-only">Statistics will populate when inventory usage and waste summary data is available.</p></section>
      </div>}
    </Dialog>
  </>;
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { user } = useApplicationWorkspace();
  const [preview, setPreview] = useState<PreviewId | null>(null);
  const [accountTotals, setAccountTotals] = useState<{ totalUsers: number; activeUsers: number; inactiveUsers: number } | null>(null);
  const [accountTotalsError, setAccountTotalsError] = useState(false);
  useEffect(() => {
    if (moduleId !== 'UserManagement') return;
    const abort = new AbortController(); setAccountTotalsError(false);
    accountSummary(abort.signal).then(setAccountTotals).catch(() => { if (!abort.signal.aborted) setAccountTotalsError(true); });
    return () => abort.abort();
  }, [moduleId]);
  const staff = user.role === 'Inventory Staff';
  if (moduleId === 'UserManagement') return <>
    <PageHeader eyebrow="Administration" title="User Management" description="Control access, manage permissions, and monitor system participants." />
    <div className="sl-admin-view sl-user-management-view">
      {/* TODO: Replace these preview values with account-summary / invitation data when those backend aggregates are available. */}
      <SummaryCards items={[
        { label: 'Total users', value: accountTotals?.totalUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Directory total from live account data', tone: 'brand', trend: 'line' },
        { label: 'Active users', value: accountTotals?.activeUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Active account total', tone: 'success', trend: 'accuracy' },
        { label: 'Pending invites', value: '—', detail: 'Invitation service not connected', tone: 'attention', trend: 'segments' },
        { label: 'Deactivated', value: accountTotals?.inactiveUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Inactive account total', tone: 'critical', trend: 'bars' },
      ]} />
      <section className="sl-user-management-panel" aria-label="User account directory">
        <AccountsTable />
      </section>

    </div>
  </>;
  if (moduleId === 'Ingredients' && user.role === 'Admin') return <IngredientsAdminPage preview={preview} setPreview={setPreview} />;

  if (moduleId === 'InventoryBatches' && user.role === 'Admin') return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Manage your ingredients and inventory batches. Track quantities, expiration dates, and stock status." />
    <div className="sl-admin-view sl-inventory-reference-view">
      <SummaryCards items={[
        { label:'Total Ingredients', value:'—', detail:'Connect inventory summary service', tone:'success', trend:'line' },
        { label:'Total Batches', value:'—', detail:'Batch service not connected', tone:'brand', trend:'segments' },
        { label:'Low Stock Items', value:'—', detail:'Awaiting stock summary', tone:'attention', trend:'bars' },
        { label:'Expiring Soon (≤ 3 days)', value:'—', detail:'Awaiting expiration service', tone:'critical', trend:'segments' },
      ]} />
      <div className="sl-inventory-reference-grid"><Card id="inventory-batches-reference" title="Inventory Batches"><div className="sl-inventory-table-tools"><button className="sl-button" type="button">All Categories</button><button className="sl-button" type="button">All Statuses</button><button className="sl-button sl-button-primary" type="button"><Plus size={16}/>Add Batch</button></div><PlaceholderTable label="Inventory Batches" columns={['Ingredient','Batch Code','Quantity','Unit','Received Date','Expiration Date','Status','Actions']} description="Inventory batch data will appear when the batch backend is connected." /></Card><aside className="sl-inventory-reference-aside"><Card id="inventory-category-reference" title="Inventory by Category"><DataState kind="empty" title="No batch analytics yet" description="Category distribution will appear from live inventory data." /></Card><Card id="inventory-quick-actions" title="Quick Actions"><div className="sl-quick-actions-grid"><WorkspaceLink to="/Ingredients">Add Ingredient</WorkspaceLink><WorkspaceLink to="/StockIn">Record Stock-In</WorkspaceLink><WorkspaceLink to="/ExpirationMonitoring">View Expiring Items</WorkspaceLink><WorkspaceLink to="/Reports">Generate Report</WorkspaceLink></div></Card></aside></div>
    </div>
  </>;
  if (moduleId === 'Roles') return <>
    <PageHeader eyebrow="Administration" title="Role responsibilities" description="Four defined roles. Permissions are enforced by the application." />
    <div className="sl-admin-view"><Card id="role-responsibilities" title="Access boundaries"><dl className="sl-guidance-list">
      {[['Super Admin', 'System-wide administration, Admin accounts and protected security oversight.'], ['Admin', 'Operational accounts, ingredient master data and administrative monitoring.'], ['Manager', 'Inventory oversight, request review and decision support.'], ['Inventory Staff', 'Stock-in, usage, waste and own change requests.']].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}
    </dl></Card></div>
  </>;
  if (moduleId === 'StockIn') return <>
    <PageHeader eyebrow="Inventory" title="Stock-In" description="Receive a new inventory batch against an existing ingredient." />
    <div className="sl-admin-view"><div className="sl-module-columns"><Card id="stock-in" title="Receive stock"><FormPreview id="StockIn" /></Card><Card id="stock-in-guide" title="Before receiving">
      <dl className="sl-guidance-list"><div><dt>Choose an ingredient</dt><dd>Use the approved catalogue and its unit of measure.</dd></div><div><dt>Record the batch</dt><dd>Capture the received quantity, cost and actual expiration date.</dd></div></dl><div className="sl-related-actions"><WorkspaceLink to="/InventoryBatches">View inventory</WorkspaceLink></div>
    </Card></div></div>
  </>;
  if (moduleId === 'UsageWaste') return <>
    <PageHeader eyebrow="Inventory oversight" title="Usage & Waste" description="Review consumption and loss as separate inventory transactions." />
    <div className="sl-admin-view"><div className="sl-workflow-links">
      <WorkflowLink to="/Usage" title="Usage Records" description="Ingredient consumption and the history behind demand forecasts." />
      <WorkflowLink to="/Waste" title="Waste Records" description="Discarded quantities, reasons and recorded waste cost." />
    </div><div className="sl-transaction-sections"><Card id="usage-history" title="Usage Records"><PlaceholderTable label="Usage records" columns={moduleContent.Usage!.columns} description="Ingredient quantities consumed from inventory batches" /></Card>
      <Card id="waste-history" title="Waste Records"><PlaceholderTable label="Waste records" columns={moduleContent.Waste!.columns} description="Discarded quantities and reasons" /></Card></div></div>
  </>;
  const content = moduleContent[moduleId]!;
  const title = moduleId === 'ChangeRequests' && staff ? 'My Change Requests' : modules[moduleId].label;
  const previewId: PreviewId | undefined = moduleId === 'Ingredients' && user.role === 'Admin' ? 'Ingredients'
    : staff && ['Usage', 'Waste', 'ChangeRequests'].includes(moduleId) ? moduleId as PreviewId : undefined;
  const previewTitle = preview === 'Ingredients' ? 'Ingredient form' : preview === 'ChangeRequests' ? 'Change request form' : preview === 'Usage' ? 'Record usage' : 'Record waste';
  return <>
    <div className="sl-page-heading-row"><PageHeader eyebrow={user.role === 'Admin' ? 'Administration' : 'Inventory & decision support'} title={title} description={content.description} />
      {previewId && <button className="sl-button" onClick={() => setPreview(previewId)}><FileInput size={18} aria-hidden="true" />Preview form</button>}
      {moduleId === 'InventoryBatches' && staff && <WorkspaceLink to="/StockIn" primary>Stock-In</WorkspaceLink>}
    </div>
    <div className="sl-admin-view">
      {content.summaryItems && <PlaceholderSummaryCards items={content.summaryItems} />}
      {(moduleId === 'InventoryBatches' || moduleId === 'ExpirationMonitoring') && <nav className="sl-module-tabs" aria-label="Inventory views">
        <Link href="/InventoryBatches" aria-current={moduleId === 'InventoryBatches' ? 'page' : undefined}>Inventory Batches</Link>
        <Link href="/Ingredients">Ingredients</Link>
        {user.role !== 'Admin' && <Link href="/ExpirationMonitoring" aria-current={moduleId === 'ExpirationMonitoring' ? 'page' : undefined}>Expiration & FEFO</Link>}
      </nav>}
      {(moduleId === 'Usage' || moduleId === 'Waste') && <nav className="sl-module-tabs" aria-label="Transaction views"><Link href="/Usage" aria-current={moduleId === 'Usage' ? 'page' : undefined}>Usage Records</Link><Link href="/Waste" aria-current={moduleId === 'Waste' ? 'page' : undefined}>Waste Records</Link></nav>}
      {moduleId === 'Forecasting' && <ForecastFlow />}
      <div className="sl-module-columns"><Card id={`module-${moduleId}`} title={moduleId === 'ChangeRequests' ? staff ? 'Your submissions' : 'Awaiting review' : content.title}>
        <PlaceholderTable label={content.title} columns={content.columns} description={staff && ['Usage', 'Waste', 'ChangeRequests'].includes(moduleId) ? 'Your records' : content.title} />
      </Card><aside><Card id={`guide-${moduleId}`} title={moduleId === 'Forecasting' ? 'Decision support' : 'Workflow guide'}><dl className="sl-guidance-list">{content.guide.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}</dl></Card></aside></div>
      {moduleId === 'ChangeRequests' && <Card id="request-history" title="Decision history"><PlaceholderTable label="Decision history" columns={['Request', 'Type', 'Target', 'Decision', 'Outcome']} description="Approved and rejected requests" rows={3} /></Card>}
    </div>
    <Dialog open={!!preview} title={previewTitle} onDismiss={() => setPreview(null)} actions={<button className="sl-button" onClick={() => setPreview(null)}>Close preview</button>}>{preview && <FormPreview id={preview} />}</Dialog>
  </>;
}
export function WorkflowLink({ to, title, description }: { to: string; title: string; description: string }) {
  return <Link href={to as Href} className="sl-workflow-link"><span><strong>{title}</strong><span className="sl-supporting">{description}</span></span><ArrowRight size={18} aria-hidden="true" /></Link>;
}
