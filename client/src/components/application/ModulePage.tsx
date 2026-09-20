import { Link, type Href } from 'expo-router';
import { AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CalendarDays, CheckCircle2, Clock3, Download, Eye, FileInput, FileText, Filter, Grid2X2, Info, Leaf, PackageX, Plus, Search, PackagePlus, Pencil, Tag, Target, Trash2, TrendingDown, TrendingUp, User, Users, UtensilsCrossed, MoreVertical, Truck, ClipboardCheck, PackageCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountsTable } from './AccountsTable';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { moduleContent, previewFields, type PreviewId } from './module-content';
import { Card, DataState, ExportControl, PageHeader, Pagination, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from './primitives';
import { modules, type ModuleId } from './workspace';
import { accountSummary, type DashboardSummary } from '../../services/administration';
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



function InventoryStaffWastePage() {
  const [addOpen,setAddOpen]=useState(false);
  const [wasteAction,setWasteAction]=useState<'view'|'edit'|'delete'|null>(null);
  const addButton=useRef<HTMLButtonElement>(null);
  const [ingredient,setIngredient]=useState(''); const [batch,setBatch]=useState(''); const [qty,setQty]=useState(''); const [reason,setReason]=useState(''); const [method,setMethod]=useState(''); const [notes,setNotes]=useState('');
  const [date,setDate]=useState(''); const [time,setTime]=useState(''); const [search,setSearch]=useState(''); const [reasonFilter,setReasonFilter]=useState('All Reasons'); const [range,setRange]=useState('Last 7 Days'); const [rows,setRows]=useState('10');
  const clear=()=>{setIngredient('');setBatch('');setQty('');setReason('');setMethod('');setNotes('');setDate('');setTime('')};
  const Pending=({label,compact=false}:{label:string;compact?:boolean})=><div className={`sl-staff-waste-pending${compact?' compact':''}`}><DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} /></div>;
  const WasteForm=()=> <form className="sl-staff-waste-form" onSubmit={e=>e.preventDefault()}>
    <label><span>Ingredient <b>*</b></span><select value={ingredient} onChange={e=>setIngredient(e.target.value)}><option value="">Search or select ingredient...</option></select></label>
    <label><span>Batch ID <b>*</b></span><select value={batch} onChange={e=>setBatch(e.target.value)}><option value="">Select batch ID...</option></select></label>
    <label><span>Expiry Date</span><input disabled placeholder="Auto-filled from selected batch" /></label>
    <label><span>Quantity Wasted <b>*</b></span><div className="sl-staff-waste-quantity"><input inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9.]/g,''))} placeholder="Enter quantity"/><select aria-label="Unit"><option>kg</option></select></div></label>
    <label><span>Date &amp; Time <b>*</b></span><div className="sl-staff-waste-datetime"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></div></label>
    <label><span>Reason for Waste <b>*</b></span><select value={reason} onChange={e=>setReason(e.target.value)}><option value="">Select reason...</option><option>Expired</option><option>Spoiled</option><option>Trimming</option><option>Over-preparation</option><option>Damaged Packaging</option><option>Other</option></select></label>
    <label><span>Disposition Method <b>*</b></span><select value={method} onChange={e=>setMethod(e.target.value)}><option value="">Select method...</option><option>Compost</option><option>Landfill</option><option>Other</option></select></label>
    <label><span>Notes (Optional)</span><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g., spoiled, damaged packaging, over-prepared..."/></label>
    <div className="sl-staff-waste-form-actions"><button type="button" className="sl-button" onClick={clear}>Clear</button><button type="button" className="sl-button sl-button-primary" title="Waste API is not connected yet"><Trash2 size={16}/>Save Waste Record</button></div>
  </form>;
  return <>
    <PageHeader title="Waste Recording" description="Record ingredients that are discarded or no longer usable. Help us reduce food waste." />
    <div className="sl-admin-view sl-staff-waste-v159">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-waste-kpis" aria-label="Waste summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Total Waste Today</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf/></span><div><span>Most Wasted Ingredient</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><BarChart3/></span><div><span>Common Waste Reason</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingDown/></span><div><span>Estimated Value Lost</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>
      <div className="sl-staff-waste-layout">
        <main className="sl-staff-waste-main">
          <section className="sl-staff-waste-card sl-staff-waste-records"><header className="sl-staff-waste-card-head"><span className="sl-staff-waste-head-icon"><Clock3/></span><h2>Recent Waste Records</h2></header>
            <div className="sl-staff-waste-toolbar"><label className="sl-staff-waste-search"><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ingredient, batch ID, or reason..."/></label><select value={reasonFilter} onChange={e=>setReasonFilter(e.target.value)}><option>All Reasons</option><option>Expired</option><option>Spoiled</option><option>Trimming</option><option>Over-preparation</option></select><select value={range} onChange={e=>setRange(e.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select><button type="button" className="sl-button" title="Export will become available when waste records are connected"><Download size={16}/>Export</button><button ref={addButton} type="button" className="sl-button sl-button-primary" onClick={()=>setAddOpen(true)}><Plus size={16}/>Add Waste</button></div>
            <div className="sl-staff-waste-table-shell"><table className="sl-data-table sl-staff-waste-table"><thead><tr>{['Date & Time','Ingredient','Batch ID','Quantity','Unit','Reason','Disposition','Recorded By','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody><tr className="sl-staff-waste-preview-row"><td colSpan={8}><Pending label="Waste records"/></td><td className="sl-staff-waste-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Waste record actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View waste record" title="View" onClick={()=>setWasteAction('view')}><Eye size={16}/></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit waste record" title="Edit" onClick={()=>setWasteAction('edit')}><Pencil size={16}/></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete waste record" title="Delete" onClick={()=>setWasteAction('delete')}><Trash2 size={16}/></button></div></td></tr></tbody></table></div>
            <footer className="sl-staff-waste-footer"><label><span>Rows per page</span><select value={rows} onChange={e=>setRows(e.target.value)}>{['10','15','50','100','150'].map(n=><option key={n}>{n}</option>)}</select></label><span>Pagination will activate when live waste records are available.</span><div className="sl-staff-waste-pagination"><button type="button">‹</button><button type="button" aria-current="page">1</button><button type="button">›</button></div></footer>
          </section>
        </main>
        <aside className="sl-staff-waste-rail">
          <section className="sl-staff-waste-card sl-staff-waste-sidecard"><header className="sl-staff-waste-card-head"><span className="sl-staff-waste-head-icon"><BarChart3/></span><h2>Waste by Reason (Last 30 Days)</h2></header><Pending label="Waste by reason" compact/></section>
          <section className="sl-staff-waste-card sl-staff-waste-sidecard"><header className="sl-staff-waste-card-head"><span className="sl-staff-waste-head-icon"><Leaf/></span><h2>Top Wasted Ingredients (Last 30 Days)</h2></header><Pending label="Top wasted ingredients" compact/></section>
        </aside>
      </div>
    </div>
    <Dialog open={addOpen} title={<span className="sl-staff-usage-dialog-title"><span className="sl-staff-waste-head-icon"><Trash2/></span><span><strong>New Waste Record</strong><small>Enter the details of the discarded ingredient.</small></span></span>} onDismiss={()=>setAddOpen(false)} returnFocus={addButton} className="sl-staff-waste-dialog"><section className="sl-staff-waste-card sl-staff-waste-modal-card"><WasteForm/></section></Dialog>
    <Dialog open={wasteAction!==null} title={wasteAction==='delete'?'Confirm Delete':wasteAction==='edit'?'Edit Waste Record':'Waste Record Details'} onDismiss={()=>setWasteAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={wasteAction==='delete'?'A live waste record is required before deletion can be confirmed.':wasteAction==='edit'?'A live waste record is required before editing.':'Waste record details will appear here when the backend is connected.'} action={<Status>Preview · data pending</Status>} /></div>
      {wasteAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={()=>setWasteAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live backend record">Confirm Delete</button></div>}
    </Dialog>
  </>;
}

function ManagerUsageWastePage() {
  const [range, setRange] = useState('Current period');
  const [category, setCategory] = useState('All Categories');
  const [ingredient, setIngredient] = useState('All Ingredients');
  const [location, setLocation] = useState('All Locations');
  const [frequency, setFrequency] = useState('Daily');
  const [wastePeriod, setWastePeriod] = useState('This Month');
  const reset = () => { setRange('Current period'); setCategory('All Categories'); setIngredient('All Ingredients'); setLocation('All Locations'); setFrequency('Daily'); setWastePeriod('This Month'); };
  const Pending = ({ description }: { description: string }) => <div className="sl-manager-usage-pending"><DataState kind="empty" title="No live records yet" description={description} action={<Status>Preview · data pending</Status>} /></div>;
  return <>
    <PageHeader title="Usage & Waste" description="Monitor ingredient usage and waste to identify trends, reduce losses, and improve efficiency." />
    <div className="sl-admin-view sl-manager-usage-waste-v121">
      <div className="sl-sa-kpis sl-admin-reference-kpis sl-manager-usage-kpis" aria-label="Usage and waste summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Total Ingredients Used</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Trash2 /></span><div><span>Total Waste</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><BarChart3 /></span><div><span>Waste Rate</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Estimated Cost of Waste</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </div>
      <section className="sl-manager-usage-filters" aria-label="Usage and waste filters">
        <label><span>Date Range</span><select className="sl-admin-input" value={range} onChange={e=>setRange(e.target.value)}><option>Current period</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option></select></label>
        <label><span>Ingredient Category</span><select className="sl-admin-input" value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option></select></label>
        <label><span>Ingredient</span><select className="sl-admin-input" value={ingredient} onChange={e=>setIngredient(e.target.value)}><option>All Ingredients</option></select></label>
        <label><span>Location</span><select className="sl-admin-input" value={location} onChange={e=>setLocation(e.target.value)}><option>All Locations</option></select></label>
        <div className="sl-manager-usage-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button><button className="sl-button sl-button-primary" type="button">Apply Filters</button></div>
      </section>

      <div className="sl-manager-usage-analytics">
        <Card id="manager-usage-trend" title="Usage vs. Waste Trend" action={<label className="sl-dashboard-filter"><select value={frequency} onChange={e=>setFrequency(e.target.value)} aria-label="Usage trend frequency"><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>}><Pending description="Usage and waste trend analytics are not connected yet." /></Card>
        <Card id="manager-waste-reason" title="Waste by Reason"><Pending description="Waste-reason analytics are not connected yet." /></Card>
        <Card id="manager-top-waste" title="Top 5 Ingredients by Waste" action={<label className="sl-dashboard-filter"><select value={wastePeriod} onChange={e=>setWastePeriod(e.target.value)} aria-label="Top waste period"><option>This Week</option><option>This Month</option><option>This Quarter</option><option>This Year</option></select></label>}><Pending description="Ingredient waste rankings are not connected yet." /></Card>
      </div>
      <section className="sl-manager-usage-records" aria-label="Usage and waste records">
        <header><div><FileInput size={18}/><strong>Usage & Waste Records</strong></div><button className="sl-button" type="button" disabled><Download size={16}/>Export</button></header>
        <div className="sl-manager-usage-table-shell"><table className="sl-data-table"><thead><tr>{['Date','Ingredient','Type','Quantity','Related Batch','Reason / Notes','Recorded By','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead></table><Pending description="Usage and waste transaction records are not connected yet." /></div>
        <footer><label>Rows per page <select className="sl-admin-input" disabled><option>10</option></select></label><span>Preview · data pending</span></footer>
      </section>
    </div>
  </>;
}


function InventoryStaffUsagePage() {
  const [rowsPerPage, setRowsPerPage] = useState('10');
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState('All Purposes');
  const [range, setRange] = useState('Last 7 Days');
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [ingredient, setIngredient] = useState('');
  const [batch, setBatch] = useState('');
  const [dateUsed, setDateUsed] = useState('');
  const [quantity, setQuantity] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [menu, setMenu] = useState('');
  const [notes, setNotes] = useState('');
  const [addUsageOpen, setAddUsageOpen] = useState(false);
  const [previewAction, setPreviewAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const addUsageButton = useRef<HTMLButtonElement>(null);
  const clearForm = () => { setIngredient(''); setBatch(''); setDateUsed(''); setQuantity(''); setUsedFor(''); setMenu(''); setNotes(''); };
  const Pending = ({ label, compact = false }: { label: string; compact?: boolean }) => (
    <div className={`sl-staff-usage-pending${compact ? ' compact' : ''}`}>
      <DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} />
    </div>
  );

  return <>
    <PageHeader
      title="Usage Recording"
      description="Record ingredients used in food preparation. Keep your inventory accurate."
    />

    <div className="sl-admin-view sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Usage summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><UtensilsCrossed aria-hidden="true" /></span>
          <div><span>Total Usage Today</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info">
          <span className="sl-sa-kpi-icon"><FileInput aria-hidden="true" /></span>
          <div><span>Total Records Today</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div><span>Most Used Ingredient</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div><span>Current Stock (After Usage)</span><strong>—</strong><small>Preview · data pending</small></div>
        </article>
      </section>

      <div className="sl-staff-usage-layout">
        <main className="sl-staff-usage-main">
          <section className="sl-staff-usage-card sl-staff-usage-records" aria-labelledby="recent-usage-title">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><Clock3 aria-hidden="true" /></span>
              <h2 id="recent-usage-title">Recent Usage Records</h2>
              <div className="sl-staff-usage-head-actions">
                <button ref={addUsageButton} type="button" className="sl-button sl-button-primary sl-staff-usage-add" onClick={()=>setAddUsageOpen(true)}><Plus size={16} aria-hidden="true" />Add Usage</button>
              </div>
            </header>
            <div className="sl-staff-usage-toolbar">
              <label className="sl-staff-usage-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ingredient, batch ID, or menu..." aria-label="Search usage records" /></label>
              <select value={purpose} onChange={e=>{setPurpose(e.target.value);setFiltersApplied(false)}} aria-label="Filter by purpose"><option>All Purposes</option><option>Menu Preparation</option><option>Staff Meal</option><option>Testing / R&amp;D</option><option>Others</option></select>
              <select value={range} onChange={e=>{setRange(e.target.value);setFiltersApplied(false)}} aria-label="Filter by date range"><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select>
              <button type="button" className={`sl-button ${filtersApplied ? '' : 'sl-button-primary'} sl-staff-usage-filter-apply`} onClick={()=>{ if(filtersApplied){ setSearch(''); setPurpose('All Purposes'); setRange('Last 7 Days'); setFiltersApplied(false); } else { setFiltersApplied(true); } }}>{filtersApplied ? 'Reset' : 'Apply'}</button>
            </div>
            <div className="sl-staff-usage-table-shell">
              <table className="sl-data-table sl-staff-usage-table">
                <thead><tr>{['Date & Time','Ingredient','Batch ID','Quantity Used','Unit','Used For','Menu','Recorded By','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr className="sl-staff-usage-preview-row">
                    <td colSpan={8} className="sl-staff-usage-preview-state-cell"><Pending label="Usage records" /></td>
                    <td className="sl-staff-usage-preview-actions-cell">
                      <div className="sl-staff-usage-row-actions" aria-label="Usage record action preview">
                        <button type="button" className="sl-icon-button" aria-label="View usage record" title="View" onClick={()=>setPreviewAction('view')}><Eye size={16} aria-hidden="true" /></button>
                        <button type="button" className="sl-icon-button" aria-label="Edit usage record" title="Edit" onClick={()=>setPreviewAction('edit')}><Pencil size={16} aria-hidden="true" /></button>
                        <button type="button" className="sl-icon-button sl-staff-usage-delete-action" aria-label="Delete usage record" title="Delete" onClick={()=>setPreviewAction('delete')}><Trash2 size={16} aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <footer className="sl-staff-usage-footer">
              <label><span>Rows per page</span><select value={rowsPerPage} onChange={e=>setRowsPerPage(e.target.value)}>{['10','15','50','100','150'].map(n=><option key={n}>{n}</option>)}</select></label>
              <span className="sl-staff-usage-pagination-note">Pagination will activate when live usage records are available.</span>
              <div className="sl-staff-usage-pagination" aria-label="Usage pagination preview"><button type="button" aria-label="Previous page">‹</button><button type="button" aria-current="page">1</button><button type="button" aria-label="Next page">›</button></div>
            </footer>
          </section>
        </main>

        <aside className="sl-staff-usage-rail">
          <section className="sl-staff-usage-card sl-staff-usage-sidecard">
            <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><Leaf aria-hidden="true" /></span><h2>FEFO Reminder</h2></header>
            <p className="sl-staff-usage-sidehint">Use batches with the earliest expiry date first.</p>
            <Pending label="FEFO reminders" compact />
          </section>
          <section className="sl-staff-usage-card sl-staff-usage-sidecard">
            <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileInput aria-hidden="true" /></span><h2>Today&apos;s Usage by Purpose</h2></header>
            <Pending label="Usage by purpose" compact />
          </section>
          <section className="sl-staff-usage-card sl-staff-usage-sidecard">
            <header className="sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon attention"><AlertTriangle aria-hidden="true" /></span><h2>Low Stock Warning</h2></header>
            <Pending label="Low-stock warnings" compact />
          </section>
        </aside>
      </div>
    </div>

    <Dialog
      open={addUsageOpen}
      title={<span className="sl-staff-usage-dialog-title"><span className="sl-staff-usage-head-icon"><FileInput aria-hidden="true" /></span><span><strong>New Usage Record</strong><small>Enter the details of the ingredient used.</small></span></span>}
      onDismiss={()=>setAddUsageOpen(false)}
      returnFocus={addUsageButton}
      className="sl-staff-usage-dialog sl-staff-usage-dialog-exact"
    >
      <section className="sl-staff-usage-card sl-staff-usage-form-card sl-staff-usage-modal-card">
        <form className="sl-staff-usage-form" onSubmit={(e)=>e.preventDefault()}>
          <label><span>Ingredient <b>*</b></span><select value={ingredient} onChange={e=>setIngredient(e.target.value)}><option value="">Search or select ingredient...</option></select></label>
          <label><span>Batch ID <b>*</b></span><select value={batch} onChange={e=>setBatch(e.target.value)}><option value="">Select batch...</option></select></label>
          <label><span>Date Used <b>*</b></span><input type="date" value={dateUsed} onChange={e=>setDateUsed(e.target.value)} /></label>
          <label><span>Quantity Used <b>*</b></span><div className="sl-staff-usage-quantity"><input inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value.replace(/[^0-9.]/g,''))} placeholder="Enter quantity" /><select aria-label="Unit"><option>kg</option></select></div></label>
          <label><span>Used For <b>*</b></span><select value={usedFor} onChange={e=>setUsedFor(e.target.value)}><option value="">Select purpose...</option><option>Menu Preparation</option><option>Staff Meal</option><option>Testing / R&amp;D</option><option>Others</option></select></label>
          <label><span>Prepared Menu (Optional)</span><input value={menu} onChange={e=>setMenu(e.target.value)} placeholder="Enter menu name..." /></label>
          <label className="sl-staff-usage-notes"><span>Notes (Optional)</span><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g., breakfast service, staff meal, etc." /></label>
          <div className="sl-staff-usage-form-actions">
            <button type="button" className="sl-button" onClick={clearForm}>Clear</button>
            <button type="button" className="sl-button sl-button-primary" title="Usage API is not connected yet"><CheckCircle2 size={16} aria-hidden="true" />Save Usage Record</button>
          </div>
        </form>
      </section>
    </Dialog>

    <Dialog
      open={previewAction === 'view'}
      title="Usage Record Details"
      onDismiss={()=>setPreviewAction(null)}
      className="sl-staff-usage-action-dialog"
    >
      <div className="sl-staff-usage-action-state">
        <DataState kind="empty" title="No live records yet" description="Usage record details will be available when the Usage Recording backend is connected." action={<Status>Preview · data pending</Status>} />
        <div className="sl-dialog-form-actions"><button type="button" className="sl-button" onClick={()=>setPreviewAction(null)}>Close</button></div>
      </div>
    </Dialog>

    <Dialog
      open={previewAction === 'edit'}
      title="Edit Usage Record"
      onDismiss={()=>setPreviewAction(null)}
      className="sl-staff-usage-action-dialog"
    >
      <div className="sl-staff-usage-action-state">
        <DataState kind="empty" title="No live records yet" description="A live usage record is required before its details can be edited." action={<Status>Preview · data pending</Status>} />
        <div className="sl-dialog-form-actions"><button type="button" className="sl-button" onClick={()=>setPreviewAction(null)}>Close</button></div>
      </div>
    </Dialog>

    <Dialog
      open={previewAction === 'delete'}
      title="Delete Usage Record?"
      onDismiss={()=>setPreviewAction(null)}
      className="sl-staff-usage-action-dialog sl-staff-usage-delete-dialog"
    >
      <div className="sl-staff-usage-delete-confirm">
        <span className="sl-staff-usage-delete-icon"><Trash2 size={22} aria-hidden="true" /></span>
        <div><strong>No live record is selected.</strong><p>Deletion will become available for each real usage row once Usage Recording is connected to the backend.</p></div>
      </div>
      <div className="sl-dialog-form-actions">
        <button type="button" className="sl-button" onClick={()=>setPreviewAction(null)}>Cancel</button>
        <button type="button" className="sl-button sl-button-danger" disabled title="Requires a live usage record">Delete</button>
      </div>
    </Dialog>
  </>;
}


function InventoryStaffStockInPage() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const addStockInButton = useRef<HTMLButtonElement>(null);
  const Pending = ({ description, compact = false }: { description: string; compact?: boolean }) => (
    <div className={`sl-staff-stockin-pending${compact ? ' compact' : ''}`}>
      <DataState kind="empty" title="No live records yet" description={description} action={<Status>Preview · data pending</Status>} />
    </div>
  );
  const StockInFormPreview = ({ asDialog = false }: { asDialog?: boolean }) => <form className={`sl-staff-stockin-form${asDialog ? ' sl-staff-stockin-form-dialog' : ''}`} aria-label="New stock-in entry preview">
    <label><span>Supplier <b>*</b></span><select disabled><option>Select supplier...</option></select></label>
    <label><span>Date Received <b>*</b></span><div className="sl-staff-stockin-date"><CalendarDays size={16} aria-hidden="true" /><input disabled value="Data pending" readOnly /></div></label>
    <label><span>Ingredient <b>*</b></span><div className="sl-staff-stockin-search"><Search size={16} aria-hidden="true" /><input disabled placeholder="Search or select ingredient..." /></div></label>
    <label><span>Batch ID <b>*</b></span><input disabled placeholder="Auto-generate or enter batch ID..." /></label>
    <label><span>Expiry Date <b>*</b></span><div className="sl-staff-stockin-date"><input disabled placeholder="Select date" /><CalendarDays size={16} aria-hidden="true" /></div></label>
    <label><span>Quantity Received <b>*</b></span><div className="sl-staff-stockin-quantity"><input disabled placeholder="Enter quantity" /><select disabled><option>kg</option></select></div></label>
    <label><span>Unit Cost (Optional)</span><div className="sl-staff-stockin-money"><span>₱</span><input disabled value="0.00" readOnly /></div></label>
    <label className="sl-staff-stockin-notes"><span>Notes (Optional)</span><input disabled placeholder="e.g., delivery condition, remarks, invoice reference..." /></label>
  </form>;

  return <>
    <PageHeader
      title="Stock-In"
      description="Record newly received ingredients into inventory. Make sure all details are accurate."
    />

    <div className="sl-admin-view sl-staff-stockin-v145">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-stockin-kpis" aria-label="Stock-in summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Truck aria-hidden="true" /></span><div><span>Total Stock-In Today</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Quantity Received</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><ClipboardCheck aria-hidden="true" /></span><div><span>Active Deliveries</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Suppliers This Month</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>

      <div className="sl-staff-stockin-layout">
        <main className="sl-staff-stockin-main">
          <section className="sl-staff-stockin-history" aria-labelledby="staff-stockin-history-title">
            <header><div><h2 id="staff-stockin-history-title" className="sl-section-title">Stock History</h2></div></header>
            <div className="sl-staff-stockin-history-filters">
              <label className="sl-staff-stockin-history-search"><span className="sl-sr-only">Search stock-in history</span><div><Search size={16} aria-hidden="true" /><input disabled placeholder="Search by ingredient, batch ID, or supplier..." /></div></label>
              <label><span className="sl-sr-only">Supplier</span><select disabled><option>All Suppliers</option></select></label>
              <label><span className="sl-sr-only">Date range</span><select disabled><option>Last 30 Days</option></select></label>
              <div className="sl-staff-stockin-history-actions"><button type="button" className="sl-button" onClick={() => {}} title="Export will become available when the backend is fully connected"><Download size={15} aria-hidden="true" />Export</button><button ref={addStockInButton} type="button" className="sl-button sl-button-primary" onClick={() => setAddModalOpen(true)}><Plus size={15} aria-hidden="true" />Add Stock-In</button></div>
            </div>
            <div className="sl-staff-stockin-table-wrap">
              <table className="sl-staff-stockin-table"><thead><tr>{['Date & Time','Ingredient','Batch ID','Supplier','Quantity','Unit','Expiry Date','Recorded By','Actions'].map(column => <th key={column}>{column}</th>)}</tr></thead></table>
              <div className="sl-staff-stockin-table-state"><Pending description="Stock-in history" /></div>
            </div>
            <footer className="sl-staff-stockin-footer"><label>Rows per page <select defaultValue="10" disabled><option>10</option></select></label><span>Pagination will activate when live stock-in records are available.</span></footer>
          </section>
        </main>

        <aside className="sl-staff-stockin-rail" aria-label="Stock-in support panels">
          <section className="sl-staff-stockin-guidelines" aria-labelledby="stockin-guidelines-title">
            <header><div><Truck size={18} aria-hidden="true" /><h2 id="stockin-guidelines-title">Receiving Guidelines</h2></div></header>
            <ol><li>Verify supplier and delivery details</li><li>Check quantity and unit of measurement</li><li>Confirm expiry date and batch condition</li><li>Keep the delivery receipt for reference</li></ol>
          </section>
          <Card id="staff-stockin-recent-deliveries" title="Recent Deliveries" action={<button type="button" className="sl-text-link sl-staff-stockin-view-all" onClick={() => {}} title="Live delivery records will open when the backend is fully connected">View All <ArrowRight size={14} /></button>}><Pending description="Recent deliveries" compact /></Card>
          <Card id="staff-stockin-low-stock" title="Low Stock Ingredients" action={<Link href="/InventoryBatches" className="sl-text-link">View All <ArrowRight size={14} /></Link>}><Pending description="Low-stock ingredients" compact /></Card>
        </aside>
      </div>
    </div>

    <Dialog
      open={addModalOpen}
      onDismiss={() => setAddModalOpen(false)}
      returnFocus={addStockInButton}
      className="sl-staff-stockin-dialog"
      title={<span className="sl-staff-stockin-dialog-heading"><span className="sl-staff-stockin-entry-icon"><Plus aria-hidden="true" /></span><span><span className="sl-staff-stockin-dialog-title">Add Stock-In</span><small>Fill in the details of the received ingredients.</small></span></span>}
      actions={<><button type="button" className="sl-button" data-initial-focus onClick={() => setAddModalOpen(false)}>Cancel</button><button type="button" className="sl-button sl-button-primary" onClick={() => {}} title="Saving will become available when the backend is fully connected">Save Stock-In</button></>}
    >
      <div className="sl-staff-stockin-dialog-body">
        <Status>Preview · data pending</Status>
        <StockInFormPreview asDialog />
      </div>
    </Dialog>
  </>;
}

function InventoryStaffInventoryBatchesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [batchStatus, setBatchStatus] = useState('All Statuses');
  const [sortBy, setSortBy] = useState('FEFO (Earliest Expiry)');
  const reset = () => {
    setSearch('');
    setCategory('All Categories');
    setBatchStatus('All Statuses');
    setSortBy('FEFO (Earliest Expiry)');
  };
  const Pending = ({ description, compact = false }: { description: string; compact?: boolean }) => (
    <div className={`sl-staff-inventory-pending${compact ? ' compact' : ''}`}>
      <DataState kind="empty" title="No live records yet" description={description} action={<Status>Preview · data pending</Status>} />
    </div>
  );

  return <>
    <PageHeader title="Inventory Batches" description="View and monitor all ingredient batches. Check stock levels, expiration dates, and FEFO order." />

    <div className="sl-admin-view sl-staff-inventory-v149">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-inventory-kpis" aria-label="Inventory batch summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Batches</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Batches Near Expiry (≤ 7 days)</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Low Stock Batches</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Expired Batches</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>

      <div className="sl-staff-inventory-layout">
        <main className="sl-staff-inventory-main">
          <section className="sl-card sl-staff-inventory-directory" aria-labelledby="staff-inventory-batches-title">
            <div className="sl-card-header sl-staff-inventory-table-title">
              <h2 id="staff-inventory-batches-title" className="sl-section-title">Inventory Batches</h2>
            </div>

            <div className="sl-card-body sl-staff-inventory-card-body">
              <div className="sl-staff-inventory-filters">
                <label className="sl-staff-inventory-search"><span className="sl-sr-only">Search inventory batches</span><div><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredient or batch ID..." /></div></label>
                <label><span className="sl-sr-only">Category</span><select value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option></select></label>
                <label><span className="sl-sr-only">Status</span><select value={batchStatus} onChange={e=>setBatchStatus(e.target.value)}><option>All Statuses</option></select></label>
                <label className="sl-staff-inventory-sort"><span className="sl-sr-only">Sort by</span><select value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Sort inventory batches"><option>FEFO (Earliest Expiry)</option><option>Latest Received</option><option>Ingredient Name</option></select></label>
                <button type="button" className="sl-button sl-staff-inventory-reset" onClick={reset}>Reset</button>
              </div>

              <div className="sl-table-scroll sl-staff-inventory-table-wrap" role="region" aria-label="Inventory Batches preview" tabIndex={0}>
                <table className="sl-data-table sl-placeholder-table sl-staff-inventory-table">
                  <thead><tr>{['','Ingredient','Batch ID','Category','Date Received','Expiry Date','Days Left','Current Stock','Unit','Status','Actions'].map((x,i)=><th scope="col" key={`${x}-${i}`}>{x}</th>)}</tr></thead>
                  <tbody><tr className="sl-placeholder-state-row"><td colSpan={11} className="sl-empty-cell"><Pending description="Inventory batch records" /></td></tr></tbody>
                </table>
              </div>

              <footer className="sl-staff-inventory-footer">
                <label>Rows per page <select defaultValue="10"><option>10</option><option>15</option><option>50</option><option>100</option><option>150</option></select></label>
                <span>Pagination will activate when live batch records are available.</span>
              </footer>
            </div>
          </section>
        </main>

        <aside className="sl-staff-inventory-rail" aria-label="Inventory analytics">
          <Card id="staff-inventory-storage" title="Storage Distribution"><Pending description="Storage distribution" compact /></Card>
          <Card id="staff-inventory-status" title="Status Breakdown"><Pending description="Inventory status breakdown" compact /></Card>
          <Card id="staff-inventory-upcoming" title="Upcoming Expirations" action={<Link href="/ExpirationMonitoring" className="sl-text-link">View All <ArrowRight size={14} aria-hidden="true" /></Link>}><Pending description="Upcoming expiration batches" compact /></Card>
        </aside>
      </div>
    </div>
  </>;
}

function ManagerInventoryPage() {
  const [category, setCategory] = useState('All Categories');
  const [status, setStatus] = useState('All Statuses');
  const [expiration, setExpiration] = useState('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All Items');
  const reset = () => { setCategory('All Categories'); setStatus('All Statuses'); setExpiration('All'); setSearch(''); setTab('All Items'); };
  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your branch." />
    <div className="sl-admin-view sl-manager-inventory-v119">
      <div className="sl-sa-kpis sl-admin-reference-kpis sl-manager-inventory-kpis" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Stock Items</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Items Near Expiry (≤ 7 days)</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Total Inventory Value</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </div>
      <section className="sl-manager-inventory-directory" aria-label="Inventory directory">
        <div className="sl-manager-inventory-filters">
          <label className="sl-manager-inventory-search"><span>Search</span><span className="sl-directory-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredient, batch ID, or supplier..." /></span></label>
          <label><span>Category</span><select className="sl-admin-input" value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option><option>Produce</option><option>Dairy</option><option>Meat & Poultry</option><option>Pantry & Others</option></select></label>
          <label><span>Stock Status</span><select className="sl-admin-input" value={status} onChange={e=>setStatus(e.target.value)}><option>All Statuses</option><option>In Stock</option><option>Low Stock</option><option>Near Expiry</option><option>Expired</option></select></label>
          <label><span>Expiration</span><select className="sl-admin-input" value={expiration} onChange={e=>setExpiration(e.target.value)}><option>All</option><option>≤ 7 days</option><option>8–30 days</option><option>&gt; 30 days</option></select></label>
          <div className="sl-manager-inventory-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button><button className="sl-button sl-button-primary" type="button">Apply Filters</button></div>
        </div>
        <div className="sl-manager-inventory-tabs-row">
          <nav className="sl-manager-inventory-tabs" aria-label="Inventory status views">{['All Items','In Stock','Low Stock','Near Expiry','Expired'].map(x=><button type="button" key={x} className={tab===x?'is-active':''} onClick={()=>setTab(x)}>{x} <span>—</span></button>)}</nav>
          <button className="sl-button" type="button" disabled><Download size={16}/>Export Inventory</button>
        </div>
        <div className="sl-manager-inventory-table-shell">
          <table className="sl-data-table sl-manager-inventory-table" aria-label="Inventory items"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Unit','Expiration Date','Days Left','Status','Supplier','Actions'].map(c=><th key={c}>{c}</th>)}</tr></thead></table>
          <div className="sl-manager-inventory-empty"><DataState kind="empty" title="No live records yet" description="Inventory batch records for this branch are not connected yet." action={<Status>Preview · data pending</Status>} /></div>
        </div>
        <div className="sl-manager-inventory-footer"><label>Rows per page <select className="sl-admin-input" disabled><option>10</option></select></label><span>Preview · data pending</span></div>
      </section>
      <div className="sl-manager-inventory-lower-grid">
        <section className="sl-manager-inventory-panel"><header><div><strong>FEFO Priority</strong><small>Top batches to use first (First Expire, First Out)</small></div><Link href="/Inventory" className="sl-text-link">View All <ArrowRight size={14}/></Link></header><div className="sl-manager-panel-empty"><DataState kind="empty" title="No live records yet" description="FEFO priority will appear when batch expiration data is connected." action={<Status>Preview · data pending</Status>} /></div></section>
        <section className="sl-manager-inventory-panel"><header><strong>Inventory by Category</strong><Link href="/ReportsAnalytics" className="sl-text-link">View Details <ArrowRight size={14}/></Link></header><div className="sl-manager-panel-empty"><DataState kind="empty" title="No live records yet" description="Category distribution requires live inventory records." action={<Status>Preview · data pending</Status>} /></div></section>
      </div>
    </div>
  </>;
}

function IngredientsAdminPage({ preview, setPreview }: { preview: PreviewId | null; setPreview: (value: PreviewId | null) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  const [previewAction, setPreviewAction] = useState<'view'|'edit'|'delete'|null>(null);
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
      listIngredients(page, 10, search.trim(), category === 'All' ? '' : category, abort.signal).then(value => {
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
  const loadedCategories = data ? new Set(data.items.map(item => item.category).filter(Boolean)).size : 0;
  const loadedUnits = data ? new Set(data.items.map(item => item.unitOfMeasure).filter(Boolean)).size : 0;
  const visibleStart = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const visibleEnd = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const exportVisible = () => {
    if (!data?.items.length) return;
    const rows = [['Ingredient','Category','Default Unit','Typical Shelf Life','Status','Date Added'], ...data.items.map(item => [item.name,item.category,item.unitOfMeasure,item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : '', 'Active', new Date(item.createdAt).toLocaleDateString()])];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='shelflifeai-ingredients-visible.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <PageHeader title="Ingredients" description="Manage ingredient master data used across your establishment." />
    <div className="sl-admin-view sl-admin-ingredients-reference">
      <section className="sl-admin-ingredient-kpis" aria-label="Ingredient summary">
        <article data-tone="success"><span className="sl-admin-ingredient-kpi-icon"><Leaf /></span><div><small>Total Ingredients</small><strong>{data ? data.total.toLocaleString() : loadError ? 'Unavailable' : '—'}</strong><span>{data ? 'Live ingredient catalogue' : loadError ? 'Ingredient API unavailable' : 'Loading live total'}</span></div></article>
        <article data-tone="attention"><span className="sl-admin-ingredient-kpi-icon"><Grid2X2 /></span><div><small>Categories</small><strong>{data ? loadedCategories : '—'}</strong><span>{data ? 'Across loaded records' : 'Live data pending'}</span></div></article>
        <article data-tone="brand"><span className="sl-admin-ingredient-kpi-icon"><Tag /></span><div><small>Common Units</small><strong>{data ? loadedUnits : '—'}</strong><span>{data ? 'Across loaded records' : 'Live data pending'}</span></div></article>
        <article data-tone="critical"><span className="sl-admin-ingredient-kpi-icon"><AlertTriangle /></span><div><small>For Review</small><strong>—</strong><span>Requires inventory batch data</span></div></article>
      </section>

      <section className="sl-admin-ingredient-filter-card" aria-label="Ingredient filters">
        <label className="sl-admin-ingredient-search"><span>Search ingredients</span><div><Search size={17}/><input type="search" placeholder="Search by name, category, or description..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div></label>
        <label><span>Category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="All">All Categories</option>{INGREDIENT_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>Unit</span><select disabled title="Unit filtering will activate when supported by the ingredient API"><option>All Units</option></select></label>
        <label><span>Status</span><select disabled title="Status filtering will activate when ingredient status is available in the API"><option>All Statuses</option></select></label>
        <button className="sl-button" type="button" onClick={() => { setSearch(''); setCategory('All'); setPage(1); }}>Reset</button>
        <button className="sl-button sl-button-primary" type="button" onClick={() => setRefresh(value => value + 1)}>Apply Filters</button>
      </section>

      <section className="sl-admin-ingredient-table-card" aria-label="Ingredients">
        <div className="sl-admin-ingredient-table-toolbar">
          <strong>{data ? `Showing ${visibleStart.toLocaleString()}–${visibleEnd.toLocaleString()} of ${data.total.toLocaleString()} ingredients` : loadError ? 'Ingredient records unavailable' : 'Loading ingredient records'}</strong>
          <div><button className="sl-button" type="button" disabled={!data?.items.length} onClick={exportVisible}><Download size={16}/>Export</button><button ref={addButtonRef} className="sl-button sl-button-primary" type="button" onClick={open}><Plus size={16}/>Add Ingredient</button></div>
        </div>
        <div className="sl-admin-ingredient-table-scroll"><table><thead><tr><th aria-label="Select"><input type="checkbox" disabled /></th><th>Ingredient</th><th>Category</th><th>Default Unit</th><th>Typical Shelf Life</th><th>Status</th><th>Date Added</th><th>Actions</th></tr></thead><tbody>
          {loadError ? <tr><td colSpan={8} className="sl-empty-cell"><DataState kind="error" title="Ingredients could not be loaded" description="The ingredient service is temporarily unavailable." action={<button type="button" className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
          : !data ? <tr><td colSpan={8} className="sl-empty-cell"><DataState kind="loading" title="Loading ingredients" description="Retrieving live ingredient records." /></td></tr>
          : !data.items.length ? <tr><td colSpan={8} className="sl-empty-cell"><DataState kind="empty" title="No live records yet" description={search || category !== 'All' ? 'No ingredients match the selected filters.' : 'Ingredient records will appear here once they are added.'} action={<Status>Preview · data pending</Status>} /></td></tr>
          : data.items.map(item => <tr key={item.id}><td><input type="checkbox" aria-label={`Select ${item.name}`} /></td><td><button className="sl-admin-ingredient-name" type="button" onClick={() => setViewIngredient(item)}><span>{item.name.trim().charAt(0).toUpperCase()}</span><strong>{item.name}</strong></button></td><td>{item.category}</td><td>{item.unitOfMeasure}</td><td>{item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : '—'}</td><td><Status>Active</Status></td><td>{new Date(item.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</td><td><div className="sl-admin-ingredient-menu"><button type="button" className="sl-icon-button" aria-label={`View ${item.name}`} onClick={() => setViewIngredient(item)}><Eye size={16}/></button><button type="button" className="sl-icon-button" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}><Pencil size={16}/></button><button type="button" className="sl-icon-button" aria-label={`Remove ${item.name}`} onClick={() => { setDeleteError(''); setDeleteTarget(item); }}><MoreVertical size={17}/></button></div></td></tr>)}
        </tbody></table></div>
        {data && <div className="sl-admin-ingredient-pagination"><label>Rows per page <select value={data.pageSize} disabled><option>{data.pageSize}</option></select></label><Pagination page={data.page} pageSize={data.pageSize} total={data.total} itemLabel="ingredients" onPageChange={setPage} /></div>}
      </section>
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
  const [supplierFilter, setSupplierFilter] = useState('All Suppliers');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: Ingredient[]; page: number; pageSize: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewIngredient, setViewIngredient] = useState<Ingredient | null>(null);
  const [editIngredient, setEditIngredient] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngredientDraft>(emptyIngredient);
  const [errors, setErrors] = useState<Partial<Record<IngredientField, string>>>({});
  const [formError, setFormError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [previewAction, setPreviewAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoadError(false);

    listIngredients(page, pageSize, search.trim(), category === 'All' ? '' : category, abort.signal)
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
  }, [page, pageSize, search, category, refresh]);

  const applyFilters = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setSearchDraft('');
    setSearch('');
    setCategory('All');
    setSupplierFilter('All Suppliers');
    setStatusFilter('All Statuses');
    setPage(1);
  };


  const setField = (key: IngredientField, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setFormError('');
  };
  const setFieldError = (key: IngredientField, value?: string) => setErrors(current => ({ ...current, [key]: value }));
  const openEdit = (item: Ingredient) => {
    setEditIngredient(item);
    setForm({ name:item.name, brand:item.brand || '', category:item.category, unit:item.unitOfMeasure, minStock:item.minimumStock === undefined ? '' : String(item.minimumStock), unitCost:item.standardUnitCost === undefined ? '' : String(item.standardUnitCost), shelfLife:item.defaultShelfLifeDays === undefined ? '' : String(item.defaultShelfLifeDays), description:item.description || '' });
    setErrors({}); setFormError('');
  };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editIngredient || actionBusy) return;
    const next: Partial<Record<IngredientField, string>> = {};
    const clean = { ...form, name: form.name.trim().replace(/\s+/g, ' '), brand: form.brand.trim().replace(/\s+/g, ' '), unit: form.unit.trim().replace(/\s+/g, ' '), description: form.description.trim().replace(/\s+/g, ' ') };
    if (!clean.name) next.name = 'Enter an ingredient name.';
    if (!clean.category) next.category = 'Select a category.';
    if (!clean.unit) next.unit = 'Enter a unit of measure.';
    for (const [key, label] of [['minStock', 'Minimum stock'], ['unitCost', 'Standard unit cost']] as const) if (clean[key] !== '' && (!Number.isFinite(Number(clean[key])) || Number(clean[key]) < 0)) next[key] = `${label} must be 0 or greater.`;
    if (clean.shelfLife !== '' && (!Number.isInteger(Number(clean.shelfLife)) || Number(clean.shelfLife) < 1)) next.shelfLife = 'Shelf life must be a whole number of at least 1 day.';
    if (Object.keys(next).length) { setErrors(next); return; }
    const input: IngredientInput = { name: clean.name, brand: clean.brand, description: clean.description, category: clean.category, unitOfMeasure: clean.unit, ...(clean.minStock === '' ? {} : { minimumStock: Number(clean.minStock) }), ...(clean.unitCost === '' ? {} : { standardUnitCost: Number(clean.unitCost) }), ...(clean.shelfLife === '' ? {} : { defaultShelfLifeDays: Number(clean.shelfLife) }) };
    setActionBusy(true); setFormError('');
    try { await updateIngredient(editIngredient.id, input); setEditIngredient(null); setRefresh(value => value + 1); }
    catch (error) { setFormError(error instanceof ApiError ? error.message : 'The ingredient could not be updated. Check your connection and try again.'); }
    finally { setActionBusy(false); }
  };
  const removeIngredient = async () => {
    if (!deleteTarget || actionBusy) return;
    setActionBusy(true); setDeleteError('');
    try { await deleteIngredient(deleteTarget.id); setDeleteTarget(null); setRefresh(value => value + 1); }
    catch (error) { setDeleteError(error instanceof ApiError ? error.message : 'The ingredient could not be removed. Check your connection and try again.'); }
    finally { setActionBusy(false); }
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
    <div className="sl-sa-ingredients-heading">
      <PageHeader
        eyebrow="System Oversight"
        title="Ingredients"
        description="Manage and monitor ingredient master data across the establishment for inventory, forecasting, and waste oversight."
      />
    </div>

    <div className="sl-admin-view sl-sa-ingredients-page">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Ingredient summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div>
            <span>Total Ingredients</span>
            <strong>{data ? data.total.toLocaleString() : loadError ? 'Unavailable' : '—'}</strong>
            <small>{data ? 'Live ingredient catalogue total' : loadError ? 'Ingredient API unavailable' : 'Loading live total'}</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info">
          <span className="sl-sa-kpi-icon"><Grid2X2 aria-hidden="true" /></span>
          <div>
            <span>Categories</span>
            <strong>—</strong>
            <small>Awaiting category summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Tag aria-hidden="true" /></span>
          <div>
            <span>Suppliers</span>
            <strong>—</strong>
            <small>Awaiting supplier summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Low-Stock Ingredients</span>
            <strong>—</strong>
            <small>Awaiting stock summary API</small>
          </div>
        </article>
      </section>

      <div className="sl-sa-ingredients-layout">
        <main className="sl-sa-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records" aria-label="Ingredient catalogue">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Ingredient Records</h2>

            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Ingredient filters">
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
              <select value={supplierFilter} onChange={event => { setSupplierFilter(event.target.value); setPage(1); }} aria-label="Supplier filter">
                <option>All Suppliers</option>
                <option disabled>Supplier values · data pending</option>
              </select>
            </label>

            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Status filter">
                <option>All Statuses</option>
                <option disabled>Status values · data pending</option>
              </select>
            </label>

            <div className="sl-sa-ingredients-filter-actions">
              <button type="button" className="sl-button" onClick={resetFilters}>Reset</button>
              <ExportControl label="Export" menuId="sl-sa-ingredients-export-menu" />
            </div>
              </div>

            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Live ingredient records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
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
                  {loadError ? (
                    <tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row"><td colSpan={6}>
                      <DataState kind="error" title="Ingredients could not be loaded" description="The ingredient service is temporarily unavailable." action={<button type="button" className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} />
                    </td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Ingredient actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View ingredient" title="View" onClick={() => setPreviewAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit ingredient" title="Edit" onClick={() => setPreviewAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete ingredient" title="Delete" onClick={() => setPreviewAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>
                  ) : !data ? (
                    <tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row"><td colSpan={6}>
                      <DataState kind="loading" title="Loading ingredients" description="Retrieving live ingredient records." />
                    </td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Ingredient actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View ingredient" title="View" onClick={() => setPreviewAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit ingredient" title="Edit" onClick={() => setPreviewAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete ingredient" title="Delete" onClick={() => setPreviewAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>
                  ) : data.items.length === 0 ? (
                    <tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row"><td colSpan={6}><SuperAdminIngredientPending label="Ingredient catalogue" /></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Ingredient actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View ingredient" title="View" onClick={() => setPreviewAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit ingredient" title="Edit" onClick={() => setPreviewAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete ingredient" title="Delete" onClick={() => setPreviewAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>
                  ) : data.items.map(item => <tr key={item.id}>
                    <td><span className="sl-sa-ingredient-name"><span className="sl-sa-ingredient-avatar" aria-hidden="true"><Leaf size={15} /></span><strong>{item.name}</strong></span></td>
                    <td><Status>{item.category}</Status></td>
                    <td>{item.unitOfMeasure}</td>
                    <td>{item.defaultShelfLifeDays ? `${item.defaultShelfLifeDays} days` : '—'}</td>
                    <td>{item.brand || '—'}</td>
                    <td>{formatUpdated(item.updatedAt)}</td>
                    <td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label={`${item.name} actions`}><button type="button" className="sl-button sl-icon-button" aria-label={`View ${item.name}`} title="View" onClick={() => setViewIngredient(item)}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label={`Edit ${item.name}`} title="Edit" onClick={() => openEdit(item)}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label={`Delete ${item.name}`} title="Delete" onClick={() => { setDeleteError(''); setDeleteTarget(item); }}><Trash2 size={16} aria-hidden="true" /></button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>

            <div className="sl-staff-usage-footer sl-sa-ingredients-footer">
              <label>
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  aria-label="Rows per page"
                  onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                </select>
              </label>
              <span className="sl-staff-usage-pagination-note">
                {data && data.total > 0 ? `Showing ${visibleStart}–${visibleEnd} of ${data.total} ingredients` : 'No live records yet'}
              </span>
              <Pagination
                compact
                page={data?.page ?? page}
                pageSize={data?.pageSize ?? pageSize}
                total={data?.total ?? 0}
                itemLabel="ingredients"
                onPageChange={setPage}
              />
            </div>
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

    <Dialog open={previewAction!==null} title={previewAction==='delete'?'Confirm Delete':previewAction==='edit'?'Edit Ingredient':'Ingredient Details'} onDismiss={() => setPreviewAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={previewAction==='delete'?'A live ingredient record is required before deletion can be confirmed.':previewAction==='edit'?'A live ingredient record is required before editing.':'Ingredient details will appear here when live records are available.'} action={<Status>Preview · data pending</Status>} /></div>
      {previewAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setPreviewAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live ingredient record">Confirm Delete</button></div>}
    </Dialog>

    <Dialog open={!!editIngredient} title="Edit Ingredient" onDismiss={() => { if (!actionBusy) setEditIngredient(null); }} busy={actionBusy} className="sl-add-user-dialog sl-account-reference-dialog">
      {editIngredient && <IngredientForm form={form} errors={errors} busy={actionBusy} formError={formError} set={setField} setError={setFieldError} onSubmit={saveEdit} />}
      <div className="sl-dialog-inline-actions"><button type="button" className="sl-button" disabled={actionBusy} onClick={() => setEditIngredient(null)}>Cancel</button><button type="submit" form="sl-ingredient-form" className="sl-button sl-button-primary" disabled={actionBusy}>{actionBusy ? 'Saving…' : 'Save Changes'}</button></div>
    </Dialog>

    <Dialog open={!!deleteTarget} title="Delete Ingredient" onDismiss={() => { if (!actionBusy) setDeleteTarget(null); }} busy={actionBusy} className="sl-add-user-dialog sl-account-reference-dialog sl-ingredient-delete-dialog" actions={<><button className="sl-button" type="button" disabled={actionBusy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="sl-button sl-button-danger" type="button" disabled={actionBusy} onClick={removeIngredient}><Trash2 size={15} aria-hidden="true" />{actionBusy ? 'Deleting…' : 'Delete'}</button></>}>
      {deleteTarget && <div className="sl-delete-reference-body">{deleteError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{deleteError}</p>}<p>Delete <strong>{deleteTarget.name}</strong>? This action uses the live ingredient service and cannot be undone.</p></div>}
    </Dialog>
  </>;
}



function SuperAdminInventoryBatchesPage() {
  const [batchSearch, setBatchSearch] = useState('');
  const [batchIngredient, setBatchIngredient] = useState('All Ingredients');
  const [batchStatus, setBatchStatus] = useState('All Statuses');
  const [batchDaysLeft, setBatchDaysLeft] = useState('All Days Left');
  const [batchDateRange, setBatchDateRange] = useState('any');
  const [batchDateFrom, setBatchDateFrom] = useState('');
  const [batchDateTo, setBatchDateTo] = useState('');
  const [batchRows, setBatchRows] = useState(10);
  const [batchPage, setBatchPage] = useState(1);
  const [batchAction, setBatchAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetBatchFilters = () => {
    setBatchSearch('');
    setBatchIngredient('All Ingredients');
    setBatchStatus('All Statuses');
    setBatchDaysLeft('All Days Left');
    setBatchDateRange('any');
    setBatchDateFrom('');
    setBatchDateTo('');
    setBatchPage(1);
  };

  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Inventory Batches"
      description="Monitor inventory batches, expiry status, and stock movement across the establishment."
    />

    <div className="sl-admin-view sl-sa-batches-page sl-sa-ingredients-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Inventory batch summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>—</strong><small>Awaiting inventory batch API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span><div><span>Active Batches</span><strong>—</strong><small>Awaiting batch status API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>—</strong><small>Awaiting expiration summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><PackageX aria-hidden="true" /></span><div><span>Expired Batches</span><strong>—</strong><small>Awaiting expiration summary API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-batches-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-batches-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records" aria-label="Inventory batch records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Inventory Batch Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Inventory batch filters">
                <label className="sl-sa-ingredients-search">
                  <span>Search batches</span>
                  <div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by batch ID or ingredient…" value={batchSearch} onChange={event => setBatchSearch(event.target.value)} /></div>
                </label>
                <label><span>Ingredient</span><select value={batchIngredient} onChange={event => { setBatchIngredient(event.target.value); setBatchPage(1); }}><option>All Ingredients</option><option disabled>Ingredient values · data pending</option></select></label>
                <label><span>Status</span><select value={batchStatus} onChange={event => { setBatchStatus(event.target.value); setBatchPage(1); }}><option>All Statuses</option><option>Active</option><option>Expiring Soon</option><option>Expired</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={batchDateRange} onChange={event => { setBatchDateRange(event.target.value); setBatchPage(1); }} aria-label="Inventory batch date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {batchDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom inventory batch date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={batchDateFrom} max={batchDateTo || undefined} onChange={event => { setBatchDateFrom(event.target.value); setBatchPage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={batchDateTo} min={batchDateFrom || undefined} onChange={event => { setBatchDateTo(event.target.value); setBatchPage(1); }} /></label></div>}
                <label><span>Days Left</span><select value={batchDaysLeft} onChange={event => { setBatchDaysLeft(event.target.value); setBatchPage(1); }}><option>All Days Left</option><option>0 days</option><option>1–3 days</option><option>4–7 days</option><option>8–14 days</option><option>15+ days</option></select></label>
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetBatchFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-batches-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Inventory batch records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Batch ID</th><th scope="col">Ingredient</th><th scope="col">Quantity</th><th scope="col">Expiration Date</th><th scope="col">Status</th><th scope="col">Days Left</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  <tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row">
                    <td colSpan={6}><DataState kind="empty" title="No live records yet" description="Inventory batch records will appear here when the inventory batch backend is connected." /></td>
                    <td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Inventory batch actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View inventory batch" title="View" onClick={() => setBatchAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit inventory batch" title="Edit" onClick={() => setBatchAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete inventory batch" title="Delete" onClick={() => setBatchAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={batchRows} aria-label="Rows per page" onChange={event => { setBatchRows(Number(event.target.value)); setBatchPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <span className="sl-staff-usage-pagination-note">No live records yet</span>
              <Pagination compact page={batchPage} pageSize={batchRows} total={0} itemLabel="batches" onPageChange={setBatchPage} />
            </div>
          </section>
        </main>
      </div>
    </div>

    <Dialog open={batchAction!==null} title={batchAction==='delete'?'Confirm Delete':batchAction==='edit'?'Edit Inventory Batch':'Inventory Batch Details'} onDismiss={() => setBatchAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={batchAction==='delete'?'A live inventory batch is required before deletion can be confirmed.':batchAction==='edit'?'A live inventory batch is required before editing.':'Inventory batch details will appear here when live records are available.'} /></div>
      {batchAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setBatchAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live inventory batch">Confirm Delete</button></div>}
    </Dialog>
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
  const [usageSearch, setUsageSearch] = useState('');
  const [usageIngredient, setUsageIngredient] = useState('All Ingredients');
  const [usageDateRange, setUsageDateRange] = useState('any');
  const [usageDateFrom, setUsageDateFrom] = useState('');
  const [usageDateTo, setUsageDateTo] = useState('');
  const [usageRows, setUsageRows] = useState(10);
  const [usagePage, setUsagePage] = useState(1);
  const [usageAction, setUsageAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetUsageFilters = () => {
    setUsageSearch('');
    setUsageIngredient('All Ingredients');
    setUsageDateRange('any');
    setUsageDateFrom('');
    setUsageDateTo('');
    setUsagePage(1);
  };

  return <>
    <div className="sl-sa-usage-heading">
      <PageHeader
        eyebrow="System Oversight"
        title="Usage"
        description="View and monitor ingredient usage across all branches. Track consumption, support forecasting, and identify usage trends."
      />
    </div>

    <div className="sl-admin-view sl-sa-usage-page sl-sa-ingredients-page sl-sa-usage-inventory-pattern sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-sa-usage-kpis" aria-label="Usage summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UtensilsCrossed aria-hidden="true" /></span><div><span>Total Usage Records</span><strong>—</strong><small>Awaiting usage records API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span><div><span>Total Quantity Used</span><strong>—</strong><small>Awaiting consumption summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Building2 aria-hidden="true" /></span><div><span>Active Branches</span><strong>—</strong><small>Awaiting branch activity API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Users Recorded Usage</span><strong>—</strong><small>Awaiting recorder summary API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-usage-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-usage-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records" aria-label="Usage records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Usage Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Usage filters">
                <label className="sl-sa-ingredients-search"><span>Search usage records</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by ingredient, batch ID, dish, or user…" value={usageSearch} onChange={event => { setUsageSearch(event.target.value); setUsagePage(1); }} /></div></label>
                <label><span>Ingredient</span><select value={usageIngredient} onChange={event => { setUsageIngredient(event.target.value); setUsagePage(1); }}><option>All Ingredients</option><option disabled>Ingredient values · data pending</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={usageDateRange} onChange={event => { setUsageDateRange(event.target.value); setUsagePage(1); }} aria-label="Usage date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {usageDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom usage date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={usageDateFrom} max={usageDateTo || undefined} onChange={event => { setUsageDateFrom(event.target.value); setUsagePage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={usageDateTo} min={usageDateFrom || undefined} onChange={event => { setUsageDateTo(event.target.value); setUsagePage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetUsageFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-usage-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Usage records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Date Used</th><th scope="col">Ingredient</th><th scope="col">Batch ID</th><th scope="col">Quantity Used</th><th scope="col">Recorded By</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-ingredients-empty-row sl-sa-ingredients-preview-row"><td colSpan={5}><DataState kind="empty" title="No live records yet" description="Usage records will appear here when the usage backend is connected." /></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Usage actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View usage record" title="View" onClick={() => setUsageAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit usage record" title="Edit" onClick={() => setUsageAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete usage record" title="Delete" onClick={() => setUsageAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={usageRows} aria-label="Rows per page" onChange={event => { setUsageRows(Number(event.target.value)); setUsagePage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <span className="sl-staff-usage-pagination-note">No live records yet</span>
              <Pagination compact page={usagePage} pageSize={usageRows} total={0} itemLabel="usage records" onPageChange={setUsagePage} />
            </div>
          </section>
        </main>

        <aside className="sl-sa-usage-analytics-rail" aria-label="Usage analytics panels">
          <Card id="sa-usage-category" title="Ingredients by Category">
            <SuperAdminUsagePending label="Usage category analytics" compact />
          </Card>
          <Card id="sa-usage-top-ingredients" title="Top Ingredients Usage">
            <SuperAdminUsagePending label="Top ingredients usage" compact />
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

    <Dialog open={usageAction!==null} title={usageAction==='delete'?'Confirm Delete':usageAction==='edit'?'Edit Usage Record':'Usage Record Details'} onDismiss={() => setUsageAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={usageAction==='delete'?'A live usage record is required before deletion can be confirmed.':usageAction==='edit'?'A live usage record is required before editing.':'Usage record details will appear here when live records are available.'} /></div>
      {usageAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setUsageAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live usage record">Confirm Delete</button></div>}
    </Dialog>
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

    <div className="sl-admin-view sl-sa-waste-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-sa-waste-kpis" aria-label="Waste summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><Trash2 aria-hidden="true" /></span>
          <div>
            <span>Total Waste</span>
            <strong>—</strong>
            <small>Awaiting waste volume API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success">
          <span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div>
            <span>Estimated Cost Loss</span>
            <strong>—</strong>
            <small>Awaiting waste valuation API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Waste Records</span>
            <strong>—</strong>
            <small>Awaiting waste records API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><PackageX aria-hidden="true" /></span>
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
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-sa-change-kpis" aria-label="Change request summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><FileInput aria-hidden="true" /></span>
          <div>
            <span>Total Requests</span>
            <strong>—</strong>
            <small>Awaiting request-summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Pending Review</span>
            <strong>—</strong>
            <small>Awaiting review queue API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success">
          <span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Approved</span>
            <strong>—</strong>
            <small>Awaiting approvals API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
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

    <div className="sl-admin-view sl-sa-expiration-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Expiration monitoring summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span>
          <div>
            <span>Expiring Soon</span>
            <strong>—</strong>
            <small>Awaiting ≤ 7-day expiry API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span>
          <div>
            <span>Expiring (8–14 days)</span>
            <strong>—</strong>
            <small>Awaiting expiry summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success">
          <span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span>
          <div>
            <span>Good Shelf Life</span>
            <strong>—</strong>
            <small>Awaiting shelf-life summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span>
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

    <div className="sl-admin-view sl-sa-forecast-page sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Forecasting summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><BarChart3 aria-hidden="true" /></span>
          <div>
            <span>Forecasted Items</span>
            <strong>—</strong>
            <small>Awaiting forecast summary API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success">
          <span className="sl-sa-kpi-icon"><Target aria-hidden="true" /></span>
          <div>
            <span>Average Forecast Accuracy</span>
            <strong>—</strong>
            <small>Awaiting forecast accuracy API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span>
          <div>
            <span>High Demand Increase</span>
            <strong>—</strong>
            <small>Awaiting demand-change API</small>
          </div>
        </article>

        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><TrendingDown aria-hidden="true" /></span>
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


function ManagerForecastingPage() {
  const [range, setRange] = useState('Current period');
  const [category, setCategory] = useState('All Categories');
  const [branch, setBranch] = useState('Current Branch');
  const [trendPeriod, setTrendPeriod] = useState('Last 30 Days');
  const Pending = ({ label, compact = false }: { label: string; compact?: boolean }) => <div className={`sl-mgr-forecast-pending${compact ? ' compact' : ''}`}><DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} /></div>;
  return <>
    <PageHeader title="Forecasting" description="AI-assisted demand forecasting to help you plan purchases, reduce waste, and ensure ingredient availability." />
    <div className="sl-admin-view sl-mgr-forecast-page">
      <section className="sl-sa-kpis sl-admin-reference-kpis sl-mgr-forecast-kpis" aria-label="Forecasting summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><FileInput /></span><div><span>Total Ingredients Forecasted</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><CalendarDays /></span><div><span>High Demand (Next 7 Days)</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>At Risk of Overstock</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>

      <section className="sl-mgr-forecast-analytics" aria-label="Forecast analytics">
        <Card id="mgr-forecast-v-actual" title="Forecast vs. Actual Usage" action={<label className="sl-dashboard-filter"><select aria-label="Forecast trend period" value={trendPeriod} onChange={e=>setTrendPeriod(e.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select></label>}><Pending label="Forecast vs. actual usage" /></Card>
        <Card id="mgr-category-demand" title="Category Demand Forecast (Next 30 Days)"><Pending label="Category demand forecast" /></Card>
        <Card id="mgr-forecast-insights" title="Forecast Insights"><Pending label="Forecast insights" /></Card>
      </section>

      <section className="sl-mgr-forecast-filters" aria-label="Forecast filters">
        <label><span>Date Range</span><select value={range} onChange={e=>setRange(e.target.value)}><option>Current period</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option></select></label>
        <label><span>Ingredient Category</span><select value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option></select></label>
        <label><span>Branch</span><select value={branch} onChange={e=>setBranch(e.target.value)}><option>Current Branch</option></select></label>
        <button className="sl-button sl-button-primary" type="button">Apply Filters</button>
      </section>

      <Card id="mgr-ingredient-forecasts" title="Ingredient Forecasts" action={<div className="sl-mgr-forecast-table-actions"><span className="sl-directory-search"><Search size={16}/><input disabled placeholder="Search ingredients..." /></span><button className="sl-button" disabled><Download size={16}/> Export Forecast</button></div>}>
        <div className="sl-mgr-forecast-tablewrap"><table><thead><tr><th>#</th><th>Ingredient</th><th>Category</th><th>Current Stock</th><th>Avg. Daily Usage</th><th>Forecasted Demand (Next 30 Days)</th><th>Recommended Action</th><th>Risk Level</th><th>Actions</th></tr></thead></table><Pending label="Ingredient forecasts" /></div>
      </Card>
    </div>
  </>;
}


function ManagerChangeRequestsPage() {
  const Pending = ({ label }: { label: string }) => <DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} />;
  return <>
    <PageHeader title="Change Requests" description="Review and decide on inventory-related requests submitted by your team." />
    <div className="sl-admin-view sl-mgr-cr-page">
      <section className="sl-mgr-cr-kpis" aria-label="Change request summary">
        <article className="sl-mgr-cr-kpi tone-blue"><span className="sl-mgr-cr-icon"><FileInput/></span><div><small>Total Requests</small><strong>—</strong><span>Preview · data pending</span></div></article>
        <article className="sl-mgr-cr-kpi tone-amber"><span className="sl-mgr-cr-icon"><Clock3/></span><div><small>Pending Review</small><strong>—</strong><span>Requires your action</span></div></article>
        <article className="sl-mgr-cr-kpi tone-green"><span className="sl-mgr-cr-icon"><CheckCircle2/></span><div><small>Approved (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article>
        <article className="sl-mgr-cr-kpi tone-red"><span className="sl-mgr-cr-icon"><AlertTriangle/></span><div><small>Rejected (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article>
      </section>
      <div className="sl-mgr-cr-layout">
        <section className="sl-mgr-cr-listcard">
          <nav className="sl-mgr-cr-tabs" aria-label="Request status">
            <button className="active">All Requests <span>—</span></button><button>Pending <span>—</span></button><button>Approved <span>—</span></button><button>Rejected <span>—</span></button>
          </nav>
          <div className="sl-mgr-cr-filters">
            <label className="search"><span className="sr-only">Search requests</span><div><Search size={17}/><input placeholder="Search requests..." disabled /></div></label>
            <label><span>Request Type</span><select disabled><option>All Types</option></select></label>
            <label><span>Submitted By</span><select disabled><option>All Staff</option></select></label>
            <label><span>Date Range</span><div className="date"><CalendarDays size={16}/><select disabled><option>Last 30 Days</option></select></div></label>
            <button className="sl-button" disabled>Reset</button>
          </div>
          <div className="sl-mgr-cr-tablewrap">
            <table className="sl-mgr-cr-table"><thead><tr><th></th><th>#</th><th>Request ID</th><th>Type</th><th>Ingredient / Batch</th><th>Requested Change</th><th>Submitted By</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead></table>
            <div className="sl-mgr-cr-empty"><Pending label="Change requests" /></div>
          </div>
          <footer className="sl-mgr-cr-footer"><label>Rows per page <select disabled><option>10</option></select></label><span>Pagination will appear when live request records are available.</span></footer>
        </section>
        <aside className="sl-mgr-cr-details">
          <header><strong>Request Details</strong><button aria-label="Close request details" disabled>×</button></header>
          <div className="sl-mgr-cr-detail-empty"><Pending label="Select a request to review its details" /></div>
          <footer><button className="reject" disabled>Reject</button><button className="approve" disabled>Approve</button></footer>
        </aside>
      </div>
    </div>
  </>;
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { user } = useApplicationWorkspace();
  const [preview, setPreview] = useState<PreviewId | null>(null);
  const [accountTotals, setAccountTotals] = useState<DashboardSummary | null>(null);
  const [accountTotalsError, setAccountTotalsError] = useState(false);
  useEffect(() => {
    if (moduleId !== 'UserManagement') return;
    const abort = new AbortController(); setAccountTotalsError(false);
    accountSummary(abort.signal).then(setAccountTotals).catch(() => { if (!abort.signal.aborted) setAccountTotalsError(true); });
    return () => abort.abort();
  }, [moduleId]);
  const staff = user.role === 'Inventory Staff';
  if (moduleId === 'UserManagement') {
    const adminUsers = user.role === 'Admin';
    const liveValue = (value: number | undefined) => accountTotals ? (value ?? 0).toLocaleString() : (accountTotalsError ? 'Unavailable' : 'Loading…');
    const total = accountTotals?.totalUsers ?? 0;
    const roleCount = (role: 'Admin' | 'Manager' | 'Inventory Staff') => accountTotals?.roleCounts?.[role] ?? 0;
    const pct = (value: number) => total ? `${Math.round((value / total) * 100)}%` : '0%';
    return <>
      <PageHeader eyebrow={adminUsers ? undefined : 'Administration'} title={adminUsers ? 'Users' : 'User Management'} description={adminUsers ? 'Manage establishment users, their roles, and access within ShelfLife AI.' : 'Control access, manage permissions, and monitor system participants.'} />
      <div className={`sl-admin-view sl-user-management-view${adminUsers ? ' sl-admin-users-reference' : ''}`}>
        {adminUsers ? <div className="sl-admin-users-kpis" aria-label="User summary">
          {[
            { label:'Total Users', value:liveValue(accountTotals?.totalUsers), detail:accountTotals ? `↑ ${accountTotals.totalUsers} live` : 'Awaiting account summary', tone:'total', Icon:Users },
            { label:'Admin', value:liveValue(roleCount('Admin')), detail:accountTotals ? pct(roleCount('Admin')) : 'Awaiting role summary', tone:'admin', Icon:User },
            { label:'Managers', value:liveValue(roleCount('Manager')), detail:accountTotals ? pct(roleCount('Manager')) : 'Awaiting role summary', tone:'manager', Icon:Users },
            { label:'Inventory Staff', value:liveValue(roleCount('Inventory Staff')), detail:accountTotals ? pct(roleCount('Inventory Staff')) : 'Awaiting role summary', tone:'staff', Icon:Users },
          ].map(({label,value,detail,tone,Icon}) => <section key={label} className="sl-admin-users-kpi" data-tone={tone}>
            <span className="sl-admin-users-kpi-icon" aria-hidden="true"><Icon size={24}/></span>
            <div className="sl-admin-users-kpi-copy"><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>
          </section>)}
        </div> : <SummaryCards items={[
          { label: 'Total users', value: liveValue(accountTotals?.totalUsers), detail: 'Directory total from live account data', tone: 'brand', trend: 'line' },
          { label: 'Active users', value: liveValue(accountTotals?.activeUsers), detail: 'Active account total', tone: 'success', trend: 'accuracy' },
          { label: 'Pending invites', value: '—', detail: 'Invitation service not connected', tone: 'attention', trend: 'segments' },
          { label: 'Deactivated', value: liveValue(accountTotals?.inactiveUsers), detail: 'Inactive account total', tone: 'critical', trend: 'bars' },
        ]} />}
        <section className="sl-user-management-panel" aria-label="User account directory">
          <AccountsTable />
        </section>
      </div>
    </>;
  }
  if (moduleId === 'Ingredients' && user.role === 'Super Admin') return <SuperAdminIngredientsPage />;
  if (moduleId === 'Ingredients' && user.role === 'Admin') return <IngredientsAdminPage preview={preview} setPreview={setPreview} />;

  if (moduleId === 'InventoryBatches' && user.role === 'Inventory Staff') return <InventoryStaffInventoryBatchesPage />;
  if (moduleId === 'InventoryBatches' && user.role === 'Manager') return <ManagerInventoryPage />;
  if (moduleId === 'InventoryBatches' && user.role === 'Super Admin') return <SuperAdminInventoryBatchesPage />;
  if (moduleId === 'Usage' && user.role === 'Super Admin') return <SuperAdminUsagePage />;
  if (moduleId === 'Usage' && user.role === 'Inventory Staff') return <InventoryStaffUsagePage />;
  if (moduleId === 'Waste' && user.role === 'Super Admin') return <SuperAdminWastePage />;
  if (moduleId === 'Waste' && user.role === 'Inventory Staff') return <InventoryStaffWastePage />;
  if (moduleId === 'ChangeRequests' && user.role === 'Manager') return <ManagerChangeRequestsPage />;
  if (moduleId === 'ChangeRequests' && user.role === 'Super Admin') return <SuperAdminChangeRequestsPage />;
  if (moduleId === 'ExpirationMonitoring' && user.role === 'Super Admin') return <SuperAdminExpirationMonitoringPage />;
  if (moduleId === 'Forecasting' && user.role === 'Manager') return <ManagerForecastingPage />;
  if (moduleId === 'Forecasting' && user.role === 'Super Admin') return <SuperAdminForecastingPage />;

  if (moduleId === 'InventoryBatches' && user.role === 'Admin') return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="View and monitor current stock levels, expiration status, and inventory distribution for your establishment." />
    <div className="sl-admin-view sl-admin-inventory-v111">
      <div className="sl-sa-kpis sl-admin-reference-kpis sl-admin-inventory-kpis" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Stock Items</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Low Stock Items</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Near Expiry (≤ 7 days)</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CalendarDays /></span><div><span>Expired Items</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </div>
      <section className="sl-admin-inventory-directory" aria-label="Inventory batches">
        <div className="sl-admin-inventory-filterbar">
          <label className="sl-admin-inventory-search"><span>Search inventory</span><span className="sl-directory-search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search ingredient, batch ID, or supplier..." aria-label="Search inventory" disabled /></span></label>
          <label><span>Category</span><select className="sl-admin-input" disabled><option>All Categories</option></select></label>
          <label><span>Status</span><select className="sl-admin-input" disabled><option>All Statuses</option></select></label>
          <div className="sl-admin-inventory-filter-actions"><button type="button" className="sl-button" disabled>Reset</button><button type="button" className="sl-button sl-button-primary" disabled>Apply Filters</button></div>
        </div>
        <div className="sl-admin-inventory-tablebar"><strong>Inventory items</strong><button type="button" className="sl-button" disabled><Download size={16} aria-hidden="true" />Export</button></div>
        <div className="sl-admin-inventory-table-shell">
          <table className="sl-data-table sl-admin-inventory-table" aria-label="Inventory items"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Unit','Expiry Date','Days Left','Status','Location','Supplier','Actions'].map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead></table>
          <div className="sl-admin-inventory-empty"><DataState kind="empty" title="No live records yet" description="Inventory batch data is not connected yet." action={<Status>Preview · data pending</Status>} /></div>
        </div>
        <div className="sl-admin-inventory-footer"><label>Rows per page <select className="sl-admin-input" disabled><option>10</option></select></label><span className="sl-admin-inventory-pagination-placeholder">Preview · data pending</span></div>
      </section>
    </div>
  </>;
  if (moduleId === 'Roles') return <>
    <PageHeader eyebrow="Administration" title="Role responsibilities" description="Four defined roles. Permissions are enforced by the application." />
    <div className="sl-admin-view"><Card id="role-responsibilities" title="Access boundaries"><dl className="sl-guidance-list">
      {[['Super Admin', 'System-wide administration, Admin accounts and protected security oversight.'], ['Admin', 'Operational accounts, ingredient master data and administrative monitoring.'], ['Manager', 'Inventory oversight, request review and decision support.'], ['Inventory Staff', 'Stock-in, usage, waste and own change requests.']].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}
    </dl></Card></div>
  </>;
  if (moduleId === 'StockIn' && user.role === 'Inventory Staff') return <InventoryStaffStockInPage />;
  if (moduleId === 'StockIn') return <>
    <PageHeader eyebrow="Inventory" title="Stock-In" description="Receive a new inventory batch against an existing ingredient." />
    <div className="sl-admin-view"><div className="sl-module-columns"><Card id="stock-in" title="Receive stock"><FormPreview id="StockIn" /></Card><Card id="stock-in-guide" title="Before receiving">
      <dl className="sl-guidance-list"><div><dt>Choose an ingredient</dt><dd>Use the approved catalogue and its unit of measure.</dd></div><div><dt>Record the batch</dt><dd>Capture the received quantity, cost and actual expiration date.</dd></div></dl><div className="sl-related-actions"><WorkspaceLink to="/InventoryBatches">View inventory</WorkspaceLink></div>
    </Card></div></div>
  </>;
  if (moduleId === 'UsageWaste' && user.role === 'Manager') return <ManagerUsageWastePage />;
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
