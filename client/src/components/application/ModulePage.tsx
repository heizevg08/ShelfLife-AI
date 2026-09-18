import { Link, type Href } from 'expo-router';
import { AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CalendarDays, CheckCircle2, Clock3, Eye, FileInput, Filter, Grid2X2, Info, Leaf, PackageX, Plus, Search, PackagePlus, Pencil, Tag, Target, Trash2, TrendingDown, TrendingUp, Users, UtensilsCrossed, MoreVertical } from 'lucide-react';
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


function SuperAdminIngredientPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-ingredients-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminIngredientsPage() {
  const [category, setCategory] = useState('All');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: Ingredient[]; page: number; pageSize: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewIngredient, setViewIngredient] = useState<Ingredient | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoadError(false);

    listIngredients(page, 10, search.trim(), category === 'All' ? '' : category, abort.signal)
      .then(value => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setLoadError(true);
          setData(null);
        }
      });

    return () => abort.abort();
  }, [page, search, category, refresh]);

  const applyFilters = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setSearchDraft('');
    setSearch('');
    setCategory('All');
    setPage(1);
  };

  const formatUpdated = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unavailable';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const visibleStart = data && data.total > 0 ? ((data.page - 1) * data.pageSize) + 1 : 0;
  const visibleEnd = data && data.total > 0 ? Math.min(data.page * data.pageSize, data.total) : 0;

  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Ingredients"
      description="Manage and monitor ingredient master data across the establishment for inventory, forecasting, and waste oversight."
    />

    <div className="sl-admin-view sl-sa-ingredients-page">
      <section className="sl-sa-ingredients-kpis" aria-label="Ingredient summary">
        <article className="sl-sa-ingredients-kpi" data-tone="success">
          <span className="sl-sa-ingredients-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div>
            <span>Total Ingredients</span>
            <strong>{data ? data.total.toLocaleString() : loadError ? 'Unavailable' : '—'}</strong>
            <small>{data ? 'Live ingredient catalogue total' : loadError ? 'Ingredient API unavailable' : 'Loading live total'}</small>
          </div>
        </article>

        <article className="sl-sa-ingredients-kpi sl-sa-ingredients-kpi-reference" data-tone="brand">
          <span className="sl-sa-ingredients-kpi-icon"><Grid2X2 aria-hidden="true" /></span>
          <div>
            <span>Categories</span>
            <strong>—</strong>
            <small>Awaiting category summary API</small>
          </div>
        </article>

        <article className="sl-sa-ingredients-kpi sl-sa-ingredients-kpi-reference" data-tone="success">
          <span className="sl-sa-ingredients-kpi-icon"><Tag aria-hidden="true" /></span>
          <div>
            <span>Suppliers</span>
            <strong>—</strong>
            <small>Awaiting supplier summary API</small>
          </div>
        </article>

        <article className="sl-sa-ingredients-kpi sl-sa-ingredients-kpi-reference" data-tone="critical">
          <span className="sl-sa-ingredients-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Low-Stock Ingredients</span>
            <strong>—</strong>
            <small>Awaiting stock summary API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-ingredients-layout">
        <main className="sl-sa-ingredients-main">
          <section className="sl-sa-ingredients-filter-card" aria-label="Ingredient filters">
            <label className="sl-sa-ingredients-search">
              <span>Search ingredients</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={searchDraft}
                  onChange={event => setSearchDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyFilters();
                    }
                  }}
                  placeholder="Search by ingredient name or brand…"
                />
              </div>
            </label>

            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={event => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
              >
                <option value="All">All Categories</option>
                {INGREDIENT_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>

            <label>
              <span>Supplier</span>
              <select disabled aria-label="Supplier filter unavailable">
                <option>Data pending</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select disabled aria-label="Status filter unavailable">
                <option>Data pending</option>
              </select>
            </label>

            <div className="sl-sa-ingredients-filter-actions">
              <button type="button" className="sl-button sl-button-primary" onClick={applyFilters}>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" onClick={resetFilters}>Reset</button>
            </div>
          </section>

          <section className="sl-sa-ingredients-table-card" aria-label="Ingredient catalogue">
            <div className="sl-sa-ingredients-table-toolbar">
              <span>
                {data
                  ? `Showing ${visibleStart.toLocaleString()}–${visibleEnd.toLocaleString()} of ${data.total.toLocaleString()} ingredients`
                  : loadError
                  ? 'Ingredient catalogue unavailable'
                  : 'Loading ingredient catalogue'}
              </span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">
                Export
              </button>
            </div>

            {loadError ? (
              <div className="sl-sa-ingredients-state">
                <DataState
                  kind="error"
                  title="Ingredients could not be loaded"
                  description="The ingredient service is temporarily unavailable."
                  action={<button type="button" className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>}
                />
              </div>
            ) : !data ? (
              <div className="sl-sa-ingredients-state">
                <DataState kind="loading" title="Loading ingredients" description="Retrieving live ingredient records." />
              </div>
            ) : data.items.length === 0 ? (
              <SuperAdminIngredientPending label="Ingredient catalogue" />
            ) : (
              <div className="sl-sa-ingredients-table-scroll" role="region" aria-label="Live ingredient records" tabIndex={0}>
                <table className="sl-sa-ingredients-table">
                  <thead>
                    <tr>
                      <th scope="col">Ingredient Name</th>
                      <th scope="col">Category</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Default Shelf Life</th>
                      <th scope="col">Brand</th>
                      <th scope="col">Last Updated</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(item => <tr key={item.id}>
                      <td>
                        <span className="sl-sa-ingredient-name">
                          <span className="sl-sa-ingredient-avatar" aria-hidden="true"><Leaf size={15} /></span>
                          <strong>{item.name}</strong>
                        </span>
                      </td>
                      <td><Status>{item.category}</Status></td>
                      <td>{item.unitOfMeasure}</td>
                      <td>{item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : '—'}</td>
                      <td>{item.brand || '—'}</td>
                      <td>{formatUpdated(item.updatedAt)}</td>
                      <td>
                        <button type="button" className="sl-icon-button" aria-label={`View ${item.name}`} onClick={() => setViewIngredient(item)}>
                          <Eye size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.total > 0 && (
              <div className="sl-sa-ingredients-pagination">
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} itemLabel="ingredients" onPageChange={setPage} compact />
              </div>
            )}
          </section>
        </main>

        <aside className="sl-sa-ingredients-rail" aria-label="Ingredient analytics">
          <Card id="sa-ingredient-distribution" title="Ingredient Distribution">
            <SuperAdminIngredientPending label="Ingredient distribution" compact />
          </Card>

          <Card id="sa-expiry-risk" title="Expiry Risk Overview">
            <SuperAdminIngredientPending label="Expiry-risk analytics" compact />
          </Card>

          <Card id="sa-top-suppliers" title="Top Suppliers">
            <SuperAdminIngredientPending label="Supplier analytics" compact />
          </Card>

          <Card id="sa-recent-ingredients" title="Recently Added Ingredients">
            <SuperAdminIngredientPending label="Recent ingredient activity" compact />
          </Card>
        </aside>
      </div>
    </div>

    <Dialog
      open={!!viewIngredient}
      title={<span className="sl-ingredient-reference-title">Ingredient Details</span>}
      onDismiss={() => setViewIngredient(null)}
      className="sl-add-user-dialog sl-account-reference-dialog sl-ingredient-view-dialog"
    >
      {viewIngredient && <div className="sl-ingredient-detail-reference">
        <div className="sl-ingredient-detail-hero sl-ingredient-detail-no-photo">
          <span className="sl-ingredient-detail-copy">
            <span className="sl-ingredient-name-row"><strong>{viewIngredient.name}</strong></span>
            <small>{viewIngredient.category} · {viewIngredient.brand || 'No brand specified'}</small>
            {viewIngredient.description && <small>{viewIngredient.description}</small>}
          </span>
        </div>

        <div className="sl-detail-grid">
          <span><small>Unit of Measure</small><strong>{viewIngredient.unitOfMeasure}</strong></span>
          <span><small>Minimum Stock Level</small><strong>{viewIngredient.minimumStock ?? '—'} {viewIngredient.unitOfMeasure}</strong></span>
          <span><small>Standard Unit Cost</small><strong>{viewIngredient.standardUnitCost === undefined ? '—' : `₱${viewIngredient.standardUnitCost.toFixed(2)} / ${viewIngredient.unitOfMeasure}`}</strong></span>
          <span><small>Default Shelf Life</small><strong>{viewIngredient.defaultShelfLifeDays ? `${viewIngredient.defaultShelfLifeDays} days` : '—'}</strong></span>
        </div>

        <SuperAdminIngredientPending label="Ingredient inventory statistics" />
      </div>}
    </Dialog>
  </>;
}



function SuperAdminInventoryBatchesPage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Inventory Batches"
      description="Monitor inventory batches, expiry status, and stock movement across the establishment."
    />

    <div className="sl-admin-view sl-sa-batches-page">
      <section className="sl-sa-batches-kpis" aria-label="Inventory batch summary">
        <article className="sl-sa-batches-kpi" data-tone="brand">
          <span className="sl-sa-batches-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div>
            <span>Total Batches</span>
            <strong>—</strong>
            <small>Awaiting inventory batch API</small>
          </div>
        </article>

        <article className="sl-sa-batches-kpi" data-tone="success">
          <span className="sl-sa-batches-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Active Batches</span>
            <strong>—</strong>
            <small>Awaiting batch status API</small>
          </div>
        </article>

        <article className="sl-sa-batches-kpi" data-tone="attention">
          <span className="sl-sa-batches-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Expiring Soon</span>
            <strong>—</strong>
            <small>Awaiting expiration summary API</small>
          </div>
        </article>

        <article className="sl-sa-batches-kpi" data-tone="critical">
          <span className="sl-sa-batches-kpi-icon"><PackageX aria-hidden="true" /></span>
          <div>
            <span>Expired Batches</span>
            <strong>—</strong>
            <small>Awaiting expiration summary API</small>
          </div>
        </article>
      </section>

      <section className="sl-sa-batches-filter-card" aria-label="Inventory batch filters">
        <label className="sl-sa-batches-search">
          <span>Search batches</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by batch ID, ingredient, or supplier…"
              disabled
              aria-label="Batch search unavailable until inventory batch API is connected"
            />
          </div>
        </label>

        <label>
          <span>Ingredient</span>
          <select disabled aria-label="Ingredient filter unavailable">
            <option>All Ingredients</option>
          </select>
        </label>

        <label>
          <span>Branch</span>
          <select disabled aria-label="Branch filter unavailable">
            <option>All Branches</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select disabled aria-label="Status filter unavailable">
            <option>All Statuses</option>
          </select>
        </label>

        <label>
          <span>Date Range</span>
          <div className="sl-sa-batches-date">
            <CalendarDays size={16} aria-hidden="true" />
            <input type="text" value="Data pending" readOnly disabled />
          </div>
        </label>

        <div className="sl-sa-batches-filter-actions">
          <button type="button" className="sl-button sl-button-primary" disabled>
            <Filter size={15} aria-hidden="true" />Filter
          </button>
          <button type="button" className="sl-button" disabled>Reset</button>
        </div>
      </section>

      <section className="sl-sa-batches-table-card" aria-label="Inventory batch records">
        <div className="sl-sa-batches-table-toolbar">
          <span>Inventory batch records</span>
          <button type="button" className="sl-button" disabled title="Export backend is not connected">
            Export
          </button>
        </div>

        <div className="sl-sa-batches-table-placeholder">
          <DataState
            kind="empty"
            title="No live records yet"
            description="Inventory batches"
            action={<Status>Preview · data pending</Status>}
          />
        </div>

        <footer className="sl-sa-batches-footer">
          <label>
            <span>Rows per page</span>
            <select defaultValue="10" disabled><option>10</option></select>
          </label>
          <span>Pagination will activate when live inventory batch records are available.</span>
        </footer>
      </section>
    </div>
  </>;
}




function SuperAdminUsagePending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-usage-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminUsagePage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Usage"
      description="View and monitor ingredient usage across all branches. Track consumption, support forecasting, and identify usage trends."
    />

    <div className="sl-admin-view sl-sa-usage-page">
      <section className="sl-sa-usage-kpis" aria-label="Usage summary">
        <article className="sl-sa-usage-kpi" data-tone="brand">
          <span className="sl-sa-usage-kpi-icon"><UtensilsCrossed aria-hidden="true" /></span>
          <div>
            <span>Total Usage Records</span>
            <strong>—</strong>
            <small>Awaiting usage records API</small>
          </div>
        </article>

        <article className="sl-sa-usage-kpi" data-tone="success">
          <span className="sl-sa-usage-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div>
            <span>Total Quantity Used</span>
            <strong>—</strong>
            <small>Awaiting consumption summary API</small>
          </div>
        </article>

        <article className="sl-sa-usage-kpi" data-tone="attention">
          <span className="sl-sa-usage-kpi-icon"><Building2 aria-hidden="true" /></span>
          <div>
            <span>Active Branches</span>
            <strong>—</strong>
            <small>Awaiting branch activity API</small>
          </div>
        </article>

        <article className="sl-sa-usage-kpi" data-tone="success">
          <span className="sl-sa-usage-kpi-icon"><Users aria-hidden="true" /></span>
          <div>
            <span>Users Recorded Usage</span>
            <strong>—</strong>
            <small>Awaiting recorder summary API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-usage-layout">
        <div className="sl-sa-usage-main">
          <section className="sl-sa-usage-filter-card" aria-label="Usage filters">
            <label className="sl-sa-usage-search">
              <span>Search usage records</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by ingredient, batch ID, dish, or user…"
                  disabled
                  aria-label="Usage search unavailable until usage service is connected"
                />
              </div>
            </label>

            <label>
              <span>Branch</span>
              <select disabled aria-label="Branch filter unavailable">
                <option>All Branches</option>
              </select>
            </label>

            <label>
              <span>Ingredient</span>
              <select disabled aria-label="Ingredient filter unavailable">
                <option>All Ingredients</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-usage-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-usage-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-usage-table-card" aria-label="Usage records">
            <div className="sl-sa-usage-table-toolbar">
              <span>Usage records</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-usage-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Usage records"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-usage-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live usage records are available.</span>
            </footer>
          </section>
        </div>

        <aside className="sl-sa-usage-rail" aria-label="Usage analytics panels">
          <Card id="sa-usage-category" title="Ingredient Usage by Category">
            <SuperAdminUsagePending label="Usage category analytics" compact />
          </Card>
          <Card id="sa-usage-top-ingredients" title="Top Ingredients by Usage">
            <SuperAdminUsagePending label="Top ingredients by usage" compact />
          </Card>
          <Card id="sa-usage-trends" title="Usage Trends">
            <SuperAdminUsagePending label="Usage trends" compact />
          </Card>
          <Card id="sa-usage-recent-activity" title="Recent Usage Activity">
            <SuperAdminUsagePending label="Usage activity" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}



function SuperAdminWastePending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-waste-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminWastePage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Waste"
      description="Track and analyze wasted ingredients across all branches. Identify key causes and support waste reduction initiatives."
    />

    <div className="sl-admin-view sl-sa-waste-page">
      <section className="sl-sa-waste-kpis" aria-label="Waste summary">
        <article className="sl-sa-waste-kpi" data-tone="brand">
          <span className="sl-sa-waste-kpi-icon"><Trash2 aria-hidden="true" /></span>
          <div>
            <span>Total Waste</span>
            <strong>—</strong>
            <small>Awaiting waste volume API</small>
          </div>
        </article>

        <article className="sl-sa-waste-kpi" data-tone="success">
          <span className="sl-sa-waste-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div>
            <span>Estimated Cost Loss</span>
            <strong>—</strong>
            <small>Awaiting waste valuation API</small>
          </div>
        </article>

        <article className="sl-sa-waste-kpi" data-tone="critical">
          <span className="sl-sa-waste-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Waste Records</span>
            <strong>—</strong>
            <small>Awaiting waste records API</small>
          </div>
        </article>

        <article className="sl-sa-waste-kpi" data-tone="attention">
          <span className="sl-sa-waste-kpi-icon"><PackageX aria-hidden="true" /></span>
          <div>
            <span>Waste Rate</span>
            <strong>—</strong>
            <small>Awaiting waste-rate API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-waste-layout">
        <div className="sl-sa-waste-main">
          <section className="sl-sa-waste-filter-card" aria-label="Waste filters">
            <label className="sl-sa-waste-search">
              <span>Search waste records</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by ingredient, batch ID, reason, or remarks…"
                  disabled
                  aria-label="Waste search unavailable until waste service is connected"
                />
              </div>
            </label>

            <label>
              <span>Branch</span>
              <select disabled aria-label="Branch filter unavailable">
                <option>All Branches</option>
              </select>
            </label>

            <label>
              <span>Reason</span>
              <select disabled aria-label="Reason filter unavailable">
                <option>All Reasons</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-waste-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-waste-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-waste-table-card" aria-label="Waste records">
            <div className="sl-sa-waste-table-toolbar">
              <span>Waste records</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-waste-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Waste records"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-waste-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live waste records are available.</span>
            </footer>
          </section>
        </div>

        <aside className="sl-sa-waste-rail" aria-label="Waste analytics panels">
          <Card id="sa-waste-reason" title="Waste by Reason">
            <SuperAdminWastePending label="Waste distribution" compact />
          </Card>
          <Card id="sa-waste-trend" title="Waste Trend">
            <SuperAdminWastePending label="Waste trend" compact />
          </Card>
          <Card id="sa-waste-top-ingredients" title="Top Wasted Ingredients">
            <SuperAdminWastePending label="Wasted ingredients" compact />
          </Card>
          <Card id="sa-waste-recent-records" title="Recent Waste Records">
            <SuperAdminWastePending label="Waste activity" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}



function SuperAdminChangeRequestsPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-change-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminChangeRequestsPage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Change Requests"
      description="Review and manage requests for changes to ingredients, inventory, and other master data."
    />

    <div className="sl-admin-view sl-sa-change-page">
      <section className="sl-sa-change-kpis" aria-label="Change request summary">
        <article className="sl-sa-change-kpi" data-tone="brand">
          <span className="sl-sa-change-kpi-icon"><FileInput aria-hidden="true" /></span>
          <div>
            <span>Total Requests</span>
            <strong>—</strong>
            <small>Awaiting request-summary API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="attention">
          <span className="sl-sa-change-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Pending Review</span>
            <strong>—</strong>
            <small>Awaiting review queue API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="success">
          <span className="sl-sa-change-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Approved</span>
            <strong>—</strong>
            <small>Awaiting approvals API</small>
          </div>
        </article>

        <article className="sl-sa-change-kpi" data-tone="critical">
          <span className="sl-sa-change-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Rejected</span>
            <strong>—</strong>
            <small>Awaiting decision API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-change-layout">
        <div className="sl-sa-change-main">
          <section className="sl-sa-change-filter-card" aria-label="Change request filters">
            <label className="sl-sa-change-search">
              <span>Search requests</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by request ID, ingredient, user, or details…"
                  disabled
                  aria-label="Change request search unavailable until request service is connected"
                />
              </div>
            </label>

            <label>
              <span>Request Type</span>
              <select disabled aria-label="Request type filter unavailable">
                <option>All Types</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select disabled aria-label="Status filter unavailable">
                <option>All Statuses</option>
              </select>
            </label>

            <label>
              <span>Requested By (Role)</span>
              <select disabled aria-label="Role filter unavailable">
                <option>All Roles</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-change-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-change-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-change-table-card" aria-label="Change requests">
            <div className="sl-sa-change-table-toolbar">
              <span>Change requests</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-change-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Change requests"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-change-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live change-request records are available.</span>
            </footer>
          </section>
        </div>

        <aside className="sl-sa-change-rail" aria-label="Change request analytics panels">
          <Card id="sa-change-type" title="Requests by Type">
            <SuperAdminChangeRequestsPending label="Change request types" compact />
          </Card>
          <Card id="sa-change-status" title="Requests by Status">
            <SuperAdminChangeRequestsPending label="Request statuses" compact />
          </Card>
          <Card id="sa-change-recent" title="Recent Activity">
            <SuperAdminChangeRequestsPending label="Change request activity" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}


function SuperAdminExpirationPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-expiration-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminExpirationMonitoringPage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Expiration / FEFO"
      description="Monitor ingredient expiration dates and manage inventory using the FEFO (First-Expired, First-Out) approach."
    />

    <div className="sl-admin-view sl-sa-expiration-page">
      <section className="sl-sa-expiration-kpis" aria-label="Expiration monitoring summary">
        <article className="sl-sa-expiration-kpi" data-tone="critical">
          <span className="sl-sa-expiration-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Expiring Soon</span>
            <strong>—</strong>
            <small>Awaiting ≤ 7-day expiry API</small>
          </div>
        </article>

        <article className="sl-sa-expiration-kpi" data-tone="attention">
          <span className="sl-sa-expiration-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Expiring (8–14 days)</span>
            <strong>—</strong>
            <small>Awaiting expiry summary API</small>
          </div>
        </article>

        <article className="sl-sa-expiration-kpi" data-tone="success">
          <span className="sl-sa-expiration-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Good Shelf Life</span>
            <strong>—</strong>
            <small>Awaiting shelf-life summary API</small>
          </div>
        </article>

        <article className="sl-sa-expiration-kpi" data-tone="brand">
          <span className="sl-sa-expiration-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div>
            <span>Total Batches</span>
            <strong>—</strong>
            <small>Awaiting inventory batch API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-expiration-layout">
        <main className="sl-sa-expiration-main">
          <section className="sl-sa-expiration-filter-card" aria-label="Expiration monitoring filters">
            <label className="sl-sa-expiration-search">
              <span>Search by ingredient, batch ID, or supplier</span>
              <div>
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by ingredient, batch ID, or supplier…"
                  disabled
                  aria-label="Expiration search unavailable until inventory batch service is connected"
                />
              </div>
            </label>

            <label>
              <span>Branch</span>
              <select disabled aria-label="Branch filter unavailable">
                <option>All Branches</option>
              </select>
            </label>

            <label>
              <span>Category</span>
              <select disabled aria-label="Category filter unavailable">
                <option>All Categories</option>
              </select>
            </label>

            <label>
              <span>Expiration Status</span>
              <select disabled aria-label="Expiration status filter unavailable">
                <option>All Statuses</option>
              </select>
            </label>

            <label>
              <span>Date Range</span>
              <div className="sl-sa-expiration-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <div className="sl-sa-expiration-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                <Filter size={15} aria-hidden="true" />Filter
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-expiration-table-card" aria-label="Expiration monitoring records">
            <div className="sl-sa-expiration-table-toolbar">
              <span>Expiration and FEFO records</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">Export</button>
            </div>

            <div className="sl-sa-expiration-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Expiration and FEFO records"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-expiration-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live expiration records are available.</span>
            </footer>
          </section>
        </main>

        <aside className="sl-sa-expiration-rail" aria-label="Expiration analytics panels">
          <Card id="sa-expiration-status" title="Expiration Status Distribution">
            <SuperAdminExpirationPending label="Expiration status distribution" compact />
          </Card>

          <Card id="sa-expiration-top-ingredients" title="Top Ingredients Nearing Expiration">
            <SuperAdminExpirationPending label="Ingredients nearing expiration" compact />
          </Card>

          <Card id="sa-expiration-fefo" title="FEFO Compliance">
            <SuperAdminExpirationPending label="FEFO compliance" compact />
          </Card>

          <Card id="sa-expiration-upcoming" title="Upcoming Expirations">
            <SuperAdminExpirationPending label="Upcoming expirations" compact />
          </Card>
        </aside>
      </div>
    </div>
  </>;
}


function SuperAdminForecastingPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-forecast-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title="No live records yet"
      description={label}
      action={<Status>Preview · data pending</Status>}
    />
  </div>;
}

function SuperAdminForecastingPage() {
  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Forecasting"
      description="View AI-generated demand forecasts, compare with actual usage, and monitor forecast accuracy across all branches."
    />

    <div className="sl-admin-view sl-sa-forecast-page">
      <section className="sl-sa-forecast-kpis" aria-label="Forecasting summary">
        <article className="sl-sa-forecast-kpi" data-tone="brand">
          <span className="sl-sa-forecast-kpi-icon"><BarChart3 aria-hidden="true" /></span>
          <div>
            <span>Forecasted Items</span>
            <strong>—</strong>
            <small>Awaiting forecast summary API</small>
          </div>
        </article>

        <article className="sl-sa-forecast-kpi" data-tone="success">
          <span className="sl-sa-forecast-kpi-icon"><Target aria-hidden="true" /></span>
          <div>
            <span>Average Forecast Accuracy</span>
            <strong>—</strong>
            <small>Awaiting forecast accuracy API</small>
          </div>
        </article>

        <article className="sl-sa-forecast-kpi" data-tone="attention">
          <span className="sl-sa-forecast-kpi-icon"><TrendingUp aria-hidden="true" /></span>
          <div>
            <span>High Demand Increase</span>
            <strong>—</strong>
            <small>Awaiting demand-change API</small>
          </div>
        </article>

        <article className="sl-sa-forecast-kpi" data-tone="critical">
          <span className="sl-sa-forecast-kpi-icon"><TrendingDown aria-hidden="true" /></span>
          <div>
            <span>Predicted Decrease</span>
            <strong>—</strong>
            <small>Awaiting demand-change API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-forecast-layout">
        <main className="sl-sa-forecast-main">
          <section className="sl-sa-forecast-filter-card" aria-label="Forecast filters">
            <label>
              <span>Branch</span>
              <select disabled aria-label="Branch filter unavailable">
                <option>All Branches</option>
              </select>
            </label>

            <label>
              <span>Category</span>
              <select disabled aria-label="Category filter unavailable">
                <option>All Categories</option>
              </select>
            </label>

            <label>
              <span>Ingredient</span>
              <select disabled aria-label="Ingredient filter unavailable">
                <option>All Ingredients</option>
              </select>
            </label>

            <label>
              <span>Forecast Period</span>
              <div className="sl-sa-forecast-date">
                <CalendarDays size={16} aria-hidden="true" />
                <input type="text" value="Data pending" readOnly disabled />
              </div>
            </label>

            <label>
              <span>Model View</span>
              <select disabled aria-label="Forecast model filter unavailable">
                <option>Demand Forecast</option>
              </select>
            </label>

            <div className="sl-sa-forecast-filter-actions">
              <button type="button" className="sl-button sl-button-primary" disabled>
                Apply
              </button>
              <button type="button" className="sl-button" disabled>Reset</button>
            </div>
          </section>

          <section className="sl-sa-forecast-chart-card">
            <div className="sl-sa-forecast-section-head">
              <div>
                <h2>Forecast vs. Actual Usage</h2>
                <p>Demand forecast compared with actual usage.</p>
              </div>
              <button type="button" className="sl-button" disabled>Last 14 days</button>
            </div>

            <div className="sl-sa-forecast-chart-state">
              <SuperAdminForecastingPending label="Forecast vs. actual usage" />
            </div>
          </section>

          <section className="sl-sa-forecast-table-card" aria-label="Forecast records">
            <div className="sl-sa-forecast-table-toolbar">
              <span>Forecast records</span>
              <button type="button" className="sl-button" disabled title="Export backend is not connected">
                Export
              </button>
            </div>

            <div className="sl-sa-forecast-table-state">
              <DataState
                kind="empty"
                title="No live records yet"
                description="Forecast records"
                action={<Status>Preview · data pending</Status>}
              />
            </div>

            <footer className="sl-sa-forecast-footer">
              <label>
                <span>Rows per page</span>
                <select defaultValue="10" disabled><option>10</option></select>
              </label>
              <span>Pagination will activate when live forecast records are available.</span>
            </footer>
          </section>
        </main>

        <aside className="sl-sa-forecast-rail" aria-label="Forecast analytics panels">
          <Card id="sa-forecast-branch-accuracy" title="Forecast Accuracy by Branch">
            <SuperAdminForecastingPending label="Branch forecast accuracy" compact />
          </Card>

          <Card id="sa-forecast-increase" title="Top Ingredients by Predicted Demand Increase">
            <SuperAdminForecastingPending label="Predicted demand increases" compact />
          </Card>

          <Card id="sa-forecast-decrease" title="Top Ingredients by Predicted Demand Decrease">
            <SuperAdminForecastingPending label="Predicted demand decreases" compact />
          </Card>

          <Card id="sa-forecast-insights" title="Forecast Insights">
            <SuperAdminForecastingPending label="Forecast insights" compact />
          </Card>
        </aside>
      </div>
    </div>
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
  if (moduleId === 'Ingredients' && user.role === 'Super Admin') return <SuperAdminIngredientsPage />;
  if (moduleId === 'Ingredients' && user.role === 'Admin') return <IngredientsAdminPage preview={preview} setPreview={setPreview} />;

  if (moduleId === 'InventoryBatches' && user.role === 'Super Admin') return <SuperAdminInventoryBatchesPage />;
  if (moduleId === 'Usage' && user.role === 'Super Admin') return <SuperAdminUsagePage />;
  if (moduleId === 'Waste' && user.role === 'Super Admin') return <SuperAdminWastePage />;
  if (moduleId === 'ChangeRequests' && user.role === 'Super Admin') return <SuperAdminChangeRequestsPage />;
  if (moduleId === 'ExpirationMonitoring' && user.role === 'Super Admin') return <SuperAdminExpirationMonitoringPage />;
  if (moduleId === 'Forecasting' && user.role === 'Super Admin') return <SuperAdminForecastingPage />;

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
