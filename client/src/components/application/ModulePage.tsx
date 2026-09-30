import { Link, type Href } from 'expo-router';
import { AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CalendarDays, CheckCircle2, Clock3, Download, Eye, FileInput, FileText, Filter, Grid2X2, Info, Leaf, PackageX, Plus, Search, PackagePlus, Pencil, Ruler, Tag, Target, Trash2, TrendingDown, TrendingUp, User, Users, UtensilsCrossed, Truck, ClipboardCheck, PackageCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { AccountsTable } from './AccountsTable';
import { APPLICATION_RECORD_PAGE_SIZES, ApplicationPendingState } from './ApplicationPatterns';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { InventoryStaffAddButton, InventoryStaffModal, InventoryStaffModalForm } from './InventoryStaffModal';
import { ingredientUnitCostApiValue, ingredientUnitCostError, ingredientUnitCostFormError, normalizeIngredientUnitCostEditingValue } from './ingredient-unit-cost';
import { moduleContent, previewFields, type PreviewId } from './module-content';
import { Card, DataState, ExportControl, PageHeader, Pagination, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from './primitives';
import { modules, type ModuleId } from './workspace';
import { accountSummary, type DashboardSummary } from '../../services/administration';
import { ApiError } from '../../services/apiClient';
import { createIngredient, deleteIngredient, getIngredientSummary, listIngredientCategories, listIngredients, listStockInIngredients, updateIngredient, type Ingredient, type IngredientInput, type StockInIngredient } from '../../services/ingredients';
import { createStockIn, getInventoryBatch, getInventoryBatchSummary, getStockInSummary, listInventoryBatches, type InventoryBatch, type InventoryBatchDisplayStatus, type InventoryBatchSummary, type StockInSummary } from '../../services/inventory-batches';
import { createUsageRecord, getUsageSummary, listUsageRecords, type UsageRecord, type UsageSummary } from '../../services/usage-records';
import { createWasteRecord, getWasteSummary, listWasteRecords, type WasteReason, type WasteRecord, type WasteSummary } from '../../services/waste-records';
import { formatDate, formatDateTime, isValidDateOnlyInput, localDateInputValue } from '../../utils/date-time';


const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;
const INGREDIENT_UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box', 'bottle', 'can', 'tray'] as const;
const STOCK_IN_DATE_RANGES = ['All dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom range'] as const;
const INVENTORY_STAFF_WASTE_REASONS = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'] as const;
type WasteField = 'ingredientId' | 'batchId' | 'quantityWasted' | 'dateWasted' | 'reason';
type WasteDraft = Record<WasteField, string>;
type IngredientDraft = { name: string; brand: string; category: string; unit: string; minStock: string; unitCost: string; shelfLife: string; description: string };
const emptyIngredient: IngredientDraft = { name:'', brand:'', category:'', unit:'', minStock:'', unitCost:'', shelfLife:'', description:'' };
type IngredientField = keyof IngredientDraft;
const ingredientApiField: Record<string, IngredientField | undefined> = { name: 'name', brand: 'brand', category: 'category', unitOfMeasure: 'unit', minimumStock: 'minStock', standardUnitCost: 'unitCost', defaultShelfLifeDays: 'shelfLife', description: 'description' };
const validShelfLife = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 1 && value <= 3650;

function wasteFieldError(field: WasteField, draft: WasteDraft, today: string) {
  if (field === 'ingredientId') return draft.ingredientId ? undefined : 'Select an ingredient.';
  if (field === 'batchId') return draft.batchId ? undefined : 'Select a batch ID.';
  if (field === 'dateWasted') {
    if (!draft.dateWasted) return 'Select the date the ingredient was wasted.';
    if (!isValidDateOnlyInput(draft.dateWasted)) return 'Enter a valid waste date.';
    return draft.dateWasted > today ? 'Date wasted cannot be in the future.' : undefined;
  }
  if (field === 'reason') return draft.reason ? undefined : 'Select a waste reason.';
  const quantity = draft.quantityWasted.trim();
  if (!quantity) return 'Enter the quantity wasted.';
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity)) return 'Enter a numeric quantity.';
  return numericQuantity > 0 ? undefined : 'Quantity wasted must be greater than 0.';
}

function wasteFormErrors(draft: WasteDraft, today: string) {
  return (Object.keys(draft) as WasteField[]).reduce<Partial<Record<WasteField, string>>>((errors, field) => {
    const error = wasteFieldError(field, draft, today);
    if (error) errors[field] = error;
    return errors;
  }, {});
}

function IngredientFields({ form, errors, busy, formError, set, setError, canonicalModal = false, showRequiredIndicators = true, reserveErrorSpace = false }: { form: IngredientDraft; errors: Partial<Record<IngredientField, string>>; busy: boolean; formError: string; set: (key: IngredientField, value: string) => void; setError: (key: IngredientField, value?: string) => void; canonicalModal?: boolean; showRequiredIndicators?: boolean; reserveErrorSpace?: boolean }) {
  const field = (key: IngredientField, label: string, control: React.ReactNode, required = true, reserveValidationSlot = reserveErrorSpace) => {
    const error = errors[key];
    return <label data-field={key} className="sl-ingredient-field-group"><span>{label}{showRequiredIndicators && required && key !== 'unitCost' && <> <b>*</b></>}</span>{control}{(error || reserveValidationSlot) && <span id={`ingredient-${key}-error`} className="sl-field-error sl-ingredient-validation-slot" data-empty={!error || undefined} aria-hidden={!error || undefined}>{error || '\u00a0'}</span>}</label>;
  };
  const validation = (key: IngredientField) => ({ 'aria-invalid': errors[key] ? true as const : undefined, 'aria-describedby': errors[key] ? `ingredient-${key}-error` : undefined });
  const pairedError = (...keys: IngredientField[]) => reserveErrorSpace && keys.some(key => Boolean(errors[key]));
  const numericChange = (key: 'minStock' | 'unitCost' | 'shelfLife', label: string, whole = false) => (value: string) => {
    set(key, value);
    if (!value) { setError(key); return; }
    const valid = whole ? /^\d+$/.test(value) : /^\d*(?:\.\d*)?$/.test(value);
    setError(key, valid ? undefined : whole ? `${label} accepts whole numbers only.` : `${label} accepts numbers only.`);
  };
  const fields = <>
    <div className="sl-ingredient-form-row">
      {field('name', 'Name', <input autoFocus disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} placeholder="e.g. Chicken Breast" value={form.name} onChange={e => set('name', e.target.value)} {...validation('name')} />, true, pairedError('name', 'category'))}
      {field('category', 'Category', <select disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} value={form.category} onChange={e => set('category', e.target.value)} {...validation('category')}><option value="">Select category</option>{INGREDIENT_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select>, true, pairedError('name', 'category'))}
    </div>
    <div className="sl-ingredient-form-row">
      {field('unit', 'Unit of Measure', <select disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} value={form.unit} onChange={e => set('unit', e.target.value)} {...validation('unit')}><option value="">Select unit</option>{INGREDIENT_UNITS.map(value => <option key={value} value={value}>{value}</option>)}</select>, true, pairedError('unit', 'minStock'))}
      {field('minStock', 'Minimum Stock', <input id="ingredient-minStock-input" disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} type="text" inputMode="decimal" placeholder="e.g. 10" value={form.minStock} onChange={e => numericChange('minStock', 'Minimum stock')(e.target.value)} {...validation('minStock')} />, true, pairedError('unit', 'minStock'))}
    </div>
    <div className="sl-ingredient-form-row">
      {field('unitCost', 'Standard Unit Cost', <span className="sl-currency-input"><span aria-hidden="true">₱</span><input id="ingredient-unitCost-input" disabled={busy} className={`${canonicalModal ? '' : 'sl-admin-input '}sl-currency-value`} type="text" inputMode="decimal" value={form.unitCost} onChange={e => { const nextValue=normalizeIngredientUnitCostEditingValue(e.target.value); set('unitCost', nextValue); setError('unitCost', ingredientUnitCostError(nextValue)); }} {...validation('unitCost')} /></span>, true, pairedError('unitCost', 'shelfLife'))}
      {field('shelfLife', 'Default Shelf Life (Days)', <input id="ingredient-shelfLife-input" disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} type="text" inputMode="numeric" placeholder="e.g. 14" value={form.shelfLife} onChange={e => numericChange('shelfLife', 'Shelf life', true)(e.target.value)} {...validation('shelfLife')} />, true, pairedError('unitCost', 'shelfLife'))}
    </div>
    <div className="sl-ingredient-form-row sl-ingredient-form-row-wide">
      {field('description', 'Description', <textarea disabled={busy} className={canonicalModal ? undefined : 'sl-admin-input'} rows={3} placeholder="e.g. Boneless, skinless chicken breast" value={form.description} onChange={e => set('description', e.target.value)} {...validation('description')} />, false)}
    </div>
  </>;
  return <>
    {formError && <p className={`sl-inline-notice sl-inline-notice-error${canonicalModal ? ' sl-staff-modal-message' : ''}`} role="alert">{formError}</p>}
    <div className="sl-form-grid">{fields}</div>
  </>;
}

function IngredientForm({ onSubmit, ...fields }: Parameters<typeof IngredientFields>[0] & { onSubmit: (event: FormEvent) => void }) {
  return <form id="sl-ingredient-form" className="sl-preview sl-live-ingredient-form sl-application-modal-form" data-form="ingredient" noValidate onSubmit={onSubmit}><IngredientFields {...fields} /></form>;
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
  const [addOpen, setAddOpen] = useState(false), addButton = useRef<HTMLButtonElement>(null);
  const wasteForm = useRef<HTMLFormElement>(null);
  const wasteFieldInteractions = useRef<Partial<Record<WasteField, boolean>>>({});
  const [ingredientId, setIngredientId] = useState(''), [batchId, setBatchId] = useState(''), [quantityWasted, setQuantityWasted] = useState(''), [reason, setReason] = useState<WasteReason | ''>(''), [dateWasted, setDateWasted] = useState('');
  const [search, setSearch] = useState(''), [reasonFilter, setReasonFilter] = useState<WasteReason | 'All Reasons'>('All Reasons'), [range, setRange] = useState('All dates'), [dateFrom, setDateFrom] = useState(''), [dateTo, setDateTo] = useState(''), [rows, setRows] = useState(10), [page, setPage] = useState(1);
  const [ingredients, setIngredients] = useState<StockInIngredient[]>([]), [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [data, setData] = useState<{ items: WasteRecord[]; total: number } | null>(null), [summary, setSummary] = useState<WasteSummary | null>(null), [loading, setLoading] = useState(false), [loadError, setLoadError] = useState(false), [busy, setBusy] = useState(false), [formMessage, setFormMessage] = useState(''), [errors, setErrors] = useState<Partial<Record<WasteField, string>>>({}), [touched, setTouched] = useState<Partial<Record<WasteField, boolean>>>({}), [submitAttempted, setSubmitAttempted] = useState(false);
  const selectedIngredient = ingredients.find(candidate => candidate.id === ingredientId);
  const selectedBatch = batches.find(candidate => candidate.id === batchId);
  const asDate = localDateInputValue;
  const todayBusinessDate = localDateInputValue();
  const queryDates = () => {
    const today = new Date(), end = asDate(today);
    if (range === 'Today') return { from: end, to: end };
    if (range === 'Last 7 Days') { const start = new Date(today); start.setDate(today.getDate() - 6); return { from: asDate(start), to: end }; }
    if (range === 'Last 30 Days') { const start = new Date(today); start.setDate(today.getDate() - 29); return { from: asDate(start), to: end }; }
    return range === 'Custom range' ? { ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) } : {};
  };
  const wasteDraft = { ingredientId, batchId, quantityWasted, dateWasted, reason };
  const resetForm = () => { wasteFieldInteractions.current = {}; setIngredientId(''); setBatchId(''); setQuantityWasted(''); setReason(''); setDateWasted(''); setErrors({}); setTouched({}); setSubmitAttempted(false); setFormMessage(''); };
  const openWasteForm = () => { resetForm(); setAddOpen(true); };
  const closeForm = () => { if (!busy) { resetForm(); setAddOpen(false); } };
  const load = async (signal: AbortSignal) => {
    const query = { page, pageSize: rows, ...(search.trim() ? { search: search.trim() } : {}), ...(reasonFilter === 'All Reasons' ? {} : { reason: reasonFilter }), ...queryDates() };
    const [records, nextSummary] = await Promise.all([listWasteRecords(query, signal), getWasteSummary(signal)]);
    setData(records); setSummary(nextSummary);
  };
  useEffect(() => { const controller = new AbortController(); listStockInIngredients(controller.signal).then(result => setIngredients(result.ingredients)).catch(() => { if (!controller.signal.aborted) setIngredients([]); }); return () => controller.abort(); }, []);
  useEffect(() => { setBatchId(''); if (!ingredientId) { setBatches([]); return; } const controller = new AbortController(); listInventoryBatches({ page: 1, pageSize: 150, ingredientId }, controller.signal).then(result => setBatches(result.items)).catch(() => { if (!controller.signal.aborted) setBatches([]); }); return () => controller.abort(); }, [ingredientId]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setLoadError(false); load(controller.signal).catch(() => { if (!controller.signal.aborted) setLoadError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [search, reasonFilter, range, dateFrom, dateTo, rows, page]);
  const submitWaste = async (event: FormEvent) => {
    event.preventDefault();
    const next = wasteFormErrors(wasteDraft, todayBusinessDate);
    const numericQuantity = Number(quantityWasted);
    if (Object.keys(next).length) { setSubmitAttempted(true); setErrors(next); requestAnimationFrame(() => wasteForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    if (!reason) return;
    setBusy(true); setErrors({}); setFormMessage('');
    try {
      await createWasteRecord({ ingredientId, batchId, quantityWasted: numericQuantity, reason, dateWasted });
      closeForm(); setPage(1);
      const controller = new AbortController(); await load(controller.signal);
    } catch (error) {
      if (error instanceof ApiError) {
        const fields: Partial<Record<WasteField, string>> = {};
        for (const detail of error.details) if (['ingredientId', 'batchId', 'quantityWasted', 'dateWasted', 'reason'].includes(detail.field)) fields[detail.field as keyof typeof fields] = detail.message;
        setSubmitAttempted(true); setErrors(fields); setFormMessage(Object.keys(fields).length ? '' : error.message);
      } else setFormMessage('Unable to save the waste record. Try again.');
    } finally { setBusy(false); }
  };
  const markWasteFieldInteraction = (field: WasteField) => { wasteFieldInteractions.current[field] = true; };
  const validateWasteFieldOnBlur = (field: WasteField) => { if (!wasteFieldInteractions.current[field]) return; setTouched(current => ({ ...current, [field]: true })); setErrors(current => ({ ...current, [field]: wasteFieldError(field, wasteDraft, todayBusinessDate) })); };
  const handleWasteQuantityChange = (value: string) => {
    const error = value.trim() || touched.quantityWasted ? wasteFieldError('quantityWasted', { ...wasteDraft, quantityWasted: value }, todayBusinessDate) : undefined;
    setQuantityWasted(value);
    markWasteFieldInteraction('quantityWasted');
    if (error && value.trim()) setTouched(current => ({ ...current, quantityWasted: true }));
    setErrors(current => ({ ...current, quantityWasted: error }));
  };
  const updateWasteFieldError = (field: Exclude<WasteField, 'quantityWasted'>, value: string) => {
    const draft = { ...wasteDraft, [field]: value } as WasteDraft;
    const error = value || touched[field] || submitAttempted ? wasteFieldError(field, draft, todayBusinessDate) : undefined;
    setErrors(current => ({ ...current, [field]: error }));
  };
  const showWasteFieldError = (field: WasteField) => Boolean(errors[field] && (touched[field] || submitAttempted));
  const fieldError = (field: WasteField) => showWasteFieldError(field) ? <span id={`waste-${field}-error`} className="sl-field-error" role="alert">{errors[field]}</span> : null;
  const invalid = (field: WasteField) => showWasteFieldError(field) ? { 'aria-invalid': true as const, 'aria-describedby': `waste-${field}-error` } : {};
  const metric = (value: number | string | undefined) => loadError && !summary ? 'Unavailable' : loading && !summary ? '—' : (value ?? '—');
  return <>
    <PageHeader eyebrow="Records" title="Waste Recording" description="Record ingredients that are discarded or no longer usable. Help us reduce food waste." />
    <div className="sl-admin-view sl-staff-waste-v159">
      <div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-waste-kpis sl-superadmin-dashboard-kpis-v201 sl-staff-usage-kpis" aria-label="Waste summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Total Waste Today</span><strong>{metric(summary?.totalWasteToday ? `${summary.totalWasteToday.quantity} ${summary.totalWasteToday.unit}` : undefined)}</strong><small>Waste quantity recorded today</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf/></span><div><span>Most Wasted Ingredient</span><strong>{metric(summary?.mostWastedIngredient ?? undefined)}</strong><small>Based on today&apos;s waste records</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><BarChart3/></span><div><span>Common Waste Reason</span><strong>{metric(summary?.commonWasteReason ?? undefined)}</strong><small>Most frequent reason today</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingDown/></span><div><span>Total Waste Cost</span><strong>{metric(summary ? `₱${summary.totalWasteCostToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined)}</strong><small>Waste cost recorded today</small></div></article>
      </section>
      </div>
      <section className="sl-application-records sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records sl-staff-waste-card sl-staff-waste-records"><header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><Clock3/></span><h2>Recent Waste Records</h2></header>
            <div className="sl-sa-ingredients-table-filters"><div className="sl-sa-ingredients-filter-card sl-staff-waste-toolbar"><label className="sl-sa-ingredients-search"><span>Search records</span><div><Search size={16}/><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search by ingredient or Batch ID..."/></div></label><label><span>Reason</span><select value={reasonFilter} onChange={e=>{setReasonFilter(e.target.value as WasteReason | 'All Reasons');setPage(1)}}><option>All Reasons</option>{INVENTORY_STAFF_WASTE_REASONS.map(value=><option key={value}>{value}</option>)}</select></label><label><span>Date range</span><select value={range} onChange={e=>{setRange(e.target.value);setPage(1)}}>{STOCK_IN_DATE_RANGES.map(value=><option key={value}>{value}</option>)}</select></label>{range==='Custom range'&&<div className="sl-v219-custom-date-range" aria-label="Custom waste date range"><label><span>From</span><input type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>{setDateFrom(e.target.value);setPage(1)}}/></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>{setDateTo(e.target.value);setPage(1)}}/></label></div>}<div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={()=>{setSearch('');setReasonFilter('All Reasons');setRange('All dates');setDateFrom('');setDateTo('');setPage(1)}}>Reset</button><InventoryStaffAddButton buttonRef={addButton} label="Record Waste" onClick={openWasteForm} /></div></div></div>
            <div className="sl-sa-ingredients-table-scroll sl-staff-waste-table-shell"><table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-waste-table"><thead><tr>{['Date & Time','Ingredient','Batch ID','Quantity Wasted','Reason','Recorded By'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{loading&&!data?<tr><td colSpan={6}><DataState kind="loading" title="Loading waste records" description="Retrieving recorded waste transactions."/></td></tr>:loadError?<tr><td colSpan={6}><DataState kind="error" title="Waste records unavailable" description="The waste service could not be reached."/></td></tr>:!data?.items.length?<tr><td colSpan={6}><DataState kind="empty" title={summary?.wasteRecordsToday || search || reasonFilter !== 'All Reasons' || range !== 'All dates' ? 'No matching records' : 'No live records yet'} description={summary?.wasteRecordsToday || search || reasonFilter !== 'All Reasons' || range !== 'All dates' ? 'No waste records match the current search and filters.' : 'Waste records will appear here after discarded inventory is recorded.'}/></td></tr>:data.items.map(record=><tr key={record.id}><td><time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time></td><td className="sl-emphasized-value" title={record.ingredient.name}>{record.ingredient.name}</td><td>{record.batch.batchID}</td><td>{record.quantityWasted} {record.unit}</td><td>{record.reason}</td><td>{record.recordedBy.name}</td></tr>)}</tbody></table></div>
            <footer className="sl-records-footer sl-staff-waste-footer sl-sa-ingredients-footer"><label><span>Rows per page</span><select value={rows} onChange={e=>{setRows(Number(e.target.value));setPage(1)}}>{[10,15,50,100,150].map(n=><option key={n}>{n}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={data?.total??0} itemLabel="waste records" onPageChange={setPage} /></footer>
      </section>
    </div>
    <InventoryStaffModal open={addOpen} busy={busy} showClose={false} className="sl-staff-waste-dialog" title="Record Waste" subtitle="Enter the details of the discarded ingredient." Icon={Trash2} onDismiss={closeForm} returnFocus={addButton}><InventoryStaffModalForm formRef={wasteForm} onSubmit={submitWaste} message={formMessage} secondaryLabel="Cancel" onSecondary={closeForm} primaryLabel="Save Waste Record" busy={busy} className="sl-staff-waste-form"><div className="sl-staff-waste-form-row"><label><span>Ingredient</span><select value={ingredientId} onPointerDown={()=>markWasteFieldInteraction('ingredientId')} onKeyDown={()=>markWasteFieldInteraction('ingredientId')} onBlur={()=>validateWasteFieldOnBlur('ingredientId')} onChange={e=>{const value=e.target.value;markWasteFieldInteraction('ingredientId');setIngredientId(value);setBatchId('');updateWasteFieldError('ingredientId',value);setErrors(current=>({...current,batchId:touched.batchId||submitAttempted?wasteFieldError('batchId',{...wasteDraft,ingredientId:value,batchId:''},todayBusinessDate):undefined}))}} {...invalid('ingredientId')}><option value="">Search or select ingredient...</option>{ingredients.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError('ingredientId')}</label><label><span>Batch ID</span><select value={batchId} disabled={!ingredientId} onPointerDown={()=>markWasteFieldInteraction('batchId')} onKeyDown={()=>markWasteFieldInteraction('batchId')} onBlur={()=>validateWasteFieldOnBlur('batchId')} onChange={e=>{const value=e.target.value;markWasteFieldInteraction('batchId');setBatchId(value);updateWasteFieldError('batchId',value)}} {...invalid('batchId')}><option value="">Select batch ID...</option>{batches.filter(item=>item.quantity>0).map(item=><option key={item.id} value={item.id}>{item.batchID}</option>)}</select>{fieldError('batchId')}</label></div><div className="sl-staff-waste-form-row"><label><span>Quantity Wasted</span><input inputMode="decimal" value={quantityWasted} onPointerDown={()=>markWasteFieldInteraction('quantityWasted')} onKeyDown={()=>markWasteFieldInteraction('quantityWasted')} onBlur={()=>validateWasteFieldOnBlur('quantityWasted')} onChange={e=>handleWasteQuantityChange(e.target.value)} placeholder="Enter quantity" {...invalid('quantityWasted')}/>{fieldError('quantityWasted')}</label><label><span>Unit</span><output className="sl-staff-derived-unit" aria-label={selectedBatch ? 'Unit derived from selected inventory batch' : selectedIngredient ? 'Unit derived from selected ingredient' : 'Unit will be derived from the selected inventory batch'}>{selectedBatch?.unit ?? selectedIngredient?.unitOfMeasure ?? '—'}</output></label></div><div className="sl-staff-waste-form-row"><label><span>Date Wasted</span><input type="date" value={dateWasted} max={todayBusinessDate} onPointerDown={()=>markWasteFieldInteraction('dateWasted')} onKeyDown={()=>markWasteFieldInteraction('dateWasted')} onBlur={()=>validateWasteFieldOnBlur('dateWasted')} onChange={e=>{const value=e.target.value;markWasteFieldInteraction('dateWasted');setDateWasted(value);updateWasteFieldError('dateWasted',value)}} {...invalid('dateWasted')}/>{fieldError('dateWasted')}</label><label><span>Reason</span><select value={reason} onPointerDown={()=>markWasteFieldInteraction('reason')} onKeyDown={()=>markWasteFieldInteraction('reason')} onBlur={()=>validateWasteFieldOnBlur('reason')} onChange={e=>{const value=e.target.value as WasteReason | '';markWasteFieldInteraction('reason');setReason(value);updateWasteFieldError('reason',value)}} {...invalid('reason')}><option value="">Select reason...</option>{INVENTORY_STAFF_WASTE_REASONS.map(value=><option key={value}>{value}</option>)}</select>{fieldError('reason')}</label></div></InventoryStaffModalForm></InventoryStaffModal>
  </>;
}

function ManagerUsageWastePage() {
  const [range, setRange] = useState('Current period');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [ingredient, setIngredient] = useState('All Ingredients');
  const [location, setLocation] = useState('All Locations');
  const [frequency, setFrequency] = useState('Daily');
  const [wastePeriod, setWastePeriod] = useState('This Month');
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const reset = () => { setRange('Current period'); setDateFrom(''); setDateTo(''); setCategory('All Categories'); setIngredient('All Ingredients'); setLocation('All Locations'); setFrequency('Daily'); setWastePeriod('This Month'); setPage(1); };
  const Pending = ({ label }: { label: string }) => <div className="sl-manager-usage-pending"><DataState kind="empty" title={`${label} unavailable`} description="Usage and waste analytics are not connected yet." /></div>;
  return <>
    <PageHeader eyebrow="Operations" title="Usage & Waste" description="Monitor ingredient usage and waste to identify trends, reduce losses, and improve efficiency." />
    <div className="sl-admin-view sl-manager-usage-waste-v121">
      <div className="sl-sa-kpis sl-admin-reference-kpis sl-manager-usage-kpis sl-kpi-reference-v201" aria-label="Usage and waste summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Total Ingredients Used</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2 /></span><div><span>Total Waste</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><BarChart3 /></span><div><span>Waste Rate</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Estimated Cost of Waste</span><strong>—</strong><small>Data unavailable</small></div></article>
      </div>
      <section className="sl-manager-usage-filters" aria-label="Usage and waste filters">
        <label><span>Date Range</span><select className="sl-admin-input" value={range} onChange={event => { setRange(event.target.value); setPage(1); }}><option>Current period</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option><option>Custom</option></select></label>
        {range === 'Custom' && <div className="sl-v219-custom-date-range" aria-label="Custom usage and waste date range"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); setPage(1); }} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); setPage(1); }} /></label></div>}
        <label><span>Ingredient Category</span><select className="sl-admin-input" value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option></select></label>
        <label><span>Ingredient</span><select className="sl-admin-input" value={ingredient} onChange={e=>setIngredient(e.target.value)}><option>All Ingredients</option></select></label>
        <label><span>Location</span><select className="sl-admin-input" value={location} onChange={e=>setLocation(e.target.value)}><option>All Locations</option></select></label>
        <div className="sl-manager-usage-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button><button className="sl-button sl-button-primary" type="button">Apply Filters</button></div>
      </section>

      <div className="sl-manager-usage-analytics">
        <Card id="manager-usage-trend" title="Usage vs. Waste Trend" action={<label className="sl-dashboard-filter"><select value={frequency} onChange={e=>setFrequency(e.target.value)} aria-label="Usage trend frequency"><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>}><Pending label="Usage and waste trend" /></Card>
        <Card id="manager-waste-reason" title="Waste by Reason"><Pending label="Waste-reason analytics" /></Card>
        <Card id="manager-top-waste" title="Top 5 Ingredients by Waste" action={<label className="sl-dashboard-filter"><select value={wastePeriod} onChange={e=>setWastePeriod(e.target.value)} aria-label="Top waste period"><option>This Week</option><option>This Month</option><option>This Quarter</option><option>This Year</option></select></label>}><Pending label="Ingredient waste rankings" /></Card>
      </div>
      <section className="sl-manager-usage-records sl-reference-records" aria-label="Usage and waste records">
        <header><div><span className="sl-staff-usage-head-icon"><FileInput size={18}/></span><strong>Usage &amp; Waste Records</strong></div><button className="sl-button sl-download-trigger" type="button" disabled><Download size={16}/>Export</button></header>
        <div className="sl-manager-usage-table-shell"><table className="sl-data-table sl-reference-records-table"><thead><tr>{['Date','Ingredient','Type','Quantity','Related Batch','Reason / Notes','Recorded By','Actions'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><tr aria-label="Usage and waste values unavailable">{Array.from({length:8}).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table></div>
        <footer className="sl-reference-records-footer"><label>Rows per page <select className="sl-admin-input" value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{[10,15,50,100,150].map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={0} itemLabel="usage and waste records" onPageChange={setPage} /></footer>
      </section>
    </div>
  </>;
}


function InventoryStaffUsagePage() {
  type UsageField = 'ingredientId' | 'batchId' | 'dateUsed' | 'quantity';
  const [rowsPerPage, setRowsPerPage] = useState('10');
  const [usagePage, setUsagePage] = useState(1);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('All dates');
  const [usageDateFrom, setUsageDateFrom] = useState('');
  const [usageDateTo, setUsageDateTo] = useState('');
  const [ingredientFilter, setIngredientFilter] = useState('All Ingredients');
  const [usageIngredients, setUsageIngredients] = useState<StockInIngredient[]>([]);
  const [usageBatches, setUsageBatches] = useState<InventoryBatch[]>([]);
  const [usageData, setUsageData] = useState<{ items: UsageRecord[]; total: number }>();
  const [usageSummary, setUsageSummary] = useState<UsageSummary>();
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [dateUsed, setDateUsed] = useState('');
  const [quantity, setQuantity] = useState('');
  const [usageMessage, setUsageMessage] = useState('');
  const [usageErrors, setUsageErrors] = useState<Partial<Record<UsageField, string>>>({});
  const [addUsageOpen, setAddUsageOpen] = useState(false);
  const addUsageButton = useRef<HTMLButtonElement>(null);
  const usageForm = useRef<HTMLFormElement>(null);
  const selectedUsageIngredient = usageIngredients.find(value => value.id === ingredientId);
  const selectedUsageBatch = usageBatches.find(value => value.id === batchId);
  const clearUsageError = (field: UsageField) => {
    setUsageErrors(current => ({ ...current, [field]: undefined }));
    setUsageMessage('');
  };
  const usageValidation = (field: UsageField) => ({
    'aria-invalid': usageErrors[field] ? true as const : undefined,
    'aria-describedby': usageErrors[field] ? `usage-${field}-error` : undefined,
  });
  const renderUsageError = (field: UsageField) => usageErrors[field] ? <span id={`usage-${field}-error`} className="sl-field-error">{usageErrors[field]}</span> : null;
  const clearForm = () => { setIngredientId(''); setBatchId(''); setDateUsed(''); setQuantity(''); setUsageBatches([]); setUsageErrors({}); setUsageMessage(''); };
  const resolveUsageRange = () => {
    const today = new Date();
    const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    if (range === 'Today') { const value = format(today); return { from: value, to: value }; }
    if (range === 'Last 7 Days') { const from = new Date(today); from.setDate(today.getDate() - 6); return { from: format(from), to: format(today) }; }
    if (range === 'Last 30 Days') { const from = new Date(today); from.setDate(today.getDate() - 29); return { from: format(from), to: format(today) }; }
    return { ...(usageDateFrom ? { from: usageDateFrom } : {}), ...(usageDateTo ? { to: usageDateTo } : {}) };
  };
  const loadUsage = async (signal?: AbortSignal) => {
    const dateRange = resolveUsageRange();
    const [data, summary] = await Promise.all([listUsageRecords({ page: usagePage, pageSize: Number(rowsPerPage), ...(search.trim() ? { search: search.trim() } : {}), ...(ingredientFilter !== 'All Ingredients' ? { ingredientId: ingredientFilter } : {}), ...dateRange }, signal), getUsageSummary(signal)]);
    setUsageData(data); setUsageSummary(summary);
  };
  const submitUsage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Partial<Record<UsageField, string>> = {};
    if (!ingredientId) next.ingredientId = 'Select an ingredient.';
    if (!batchId) next.batchId = 'Select a batch.';
    if (!dateUsed) next.dateUsed = 'Select the date used.';
    if (!quantity) next.quantity = 'Enter the quantity used.';
    const numericQuantity = Number(quantity);
    if (quantity && (!Number.isFinite(numericQuantity) || numericQuantity <= 0)) next.quantity = 'Enter a quantity greater than 0.';
    if (Object.keys(next).length) {
      setUsageErrors(next);
      setUsageMessage('');
      requestAnimationFrame(() => usageForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setUsageErrors({});
    try {
      await createUsageRecord({ ingredientId, batchId, dateUsed, quantityUsed: numericQuantity });
      clearForm(); setAddUsageOpen(false); setUsagePage(1); await loadUsage();
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors: Partial<Record<UsageField, string>> = {};
        for (const detail of error.details) if (['ingredientId', 'batchId', 'dateUsed', 'quantityUsed'].includes(detail.field)) fieldErrors[detail.field === 'quantityUsed' ? 'quantity' : detail.field as UsageField] = detail.message;
        setUsageErrors(fieldErrors); setUsageMessage(Object.keys(fieldErrors).length ? '' : error.message);
      } else setUsageMessage('Unable to save usage. Try again.');
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    listStockInIngredients(controller.signal).then(result => setUsageIngredients(result.ingredients)).catch(() => {
      if (!controller.signal.aborted) setUsageIngredients([]);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!ingredientId) { setUsageBatches([]); return; }
    const controller = new AbortController();
    listInventoryBatches({ page: 1, pageSize: 150, ingredientId }, controller.signal).then(result => setUsageBatches(result.items)).catch(() => {
      if (!controller.signal.aborted) setUsageBatches([]);
    });
    return () => controller.abort();
  }, [ingredientId]);
  useEffect(() => {
    const controller = new AbortController(); setUsageLoading(true); setUsageError(false);
    loadUsage(controller.signal).catch(() => { if (!controller.signal.aborted) setUsageError(true); }).finally(() => { if (!controller.signal.aborted) setUsageLoading(false); });
    return () => controller.abort();
  }, [search, ingredientFilter, range, usageDateFrom, usageDateTo, rowsPerPage, usagePage]);
  const usageMetric = (value: number | string | undefined) => usageError && !usageSummary ? 'Unavailable' : usageLoading && !usageSummary ? '—' : (value ?? '—');

  return <>
    <PageHeader
      eyebrow="Records"
      title="Usage Recording"
      description="Record ingredient usage and maintain accurate inventory quantities."
    />

    <div className="sl-admin-view sl-staff-usage-v150">
      <div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Usage summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand">
          <span className="sl-sa-kpi-icon"><UtensilsCrossed aria-hidden="true" /></span>
          <div><span>Total Usage Today</span><strong>{usageMetric(usageSummary?.totalUsageToday ? `${usageSummary.totalUsageToday.quantity} ${usageSummary.totalUsageToday.unit}` : undefined)}</strong><small>Usage quantity recorded today</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info">
          <span className="sl-sa-kpi-icon"><FileInput aria-hidden="true" /></span>
          <div><span>Usage Records Today</span><strong>{usageMetric(usageSummary?.usageRecordsToday)}</strong><small>Usage transactions recorded today</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention">
          <span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span>
          <div><span>Most Used Ingredient</span><strong>{usageMetric(usageSummary?.mostUsedIngredient ?? undefined)}</strong><small>Based on recorded usage</small></div>
        </article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical">
          <span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span>
          <div><span>Ingredients Used This Week</span><strong>{usageMetric(usageSummary?.ingredientsUsedThisWeek)}</strong><small>Distinct ingredients used this week</small></div>
        </article>
      </section></div>

      <div className="sl-usage-records-layout">
          <section className="sl-application-records sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-labelledby="recent-usage-title">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><Clock3 aria-hidden="true" /></span>
              <h2 id="recent-usage-title">Recent Usage Records</h2>
            </header>
            <div className="sl-sa-ingredients-table-filters"><div className="sl-sa-ingredients-filter-card sl-staff-usage-toolbar">
              <label className="sl-sa-ingredients-search"><span>Search records</span><div><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setUsagePage(1)}} placeholder="Search by ingredient or Batch ID..." aria-label="Search usage records" /></div></label>
              <label><span>Ingredient</span><select value={ingredientFilter} onChange={e=>{setIngredientFilter(e.target.value);setUsagePage(1)}} aria-label="Filter by ingredient"><option>All Ingredients</option>{usageIngredients.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
              <label className="sl-usage-date-range"><span>Date range</span><select value={range} onChange={e=>{setRange(e.target.value);setUsagePage(1)}} aria-label="Filter by date range">{STOCK_IN_DATE_RANGES.map(value=><option key={value}>{value}</option>)}</select></label>
              {range === 'Custom range' && <div className="sl-v219-custom-date-range" aria-label="Custom usage date range"><label><span>From</span><input type="date" value={usageDateFrom} max={usageDateTo || undefined} onChange={event => {setUsageDateFrom(event.target.value);setUsagePage(1)}} /></label><label><span>To</span><input type="date" value={usageDateTo} min={usageDateFrom || undefined} onChange={event => {setUsageDateTo(event.target.value);setUsagePage(1)}} /></label></div>}
              <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={()=>{setSearch('');setIngredientFilter('All Ingredients');setRange('All dates');setUsageDateFrom('');setUsageDateTo('');setUsagePage(1)}}>Reset</button><InventoryStaffAddButton buttonRef={addUsageButton} label="Record Usage" onClick={()=>setAddUsageOpen(true)} /></div>
            </div></div>
            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell">
              <table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table">
                <thead><tr><th data-usage-column="date-time">Date &amp; Time</th><th data-usage-column="ingredient">Ingredient</th><th data-usage-column="batch-id">Batch ID</th><th data-usage-column="quantity">Quantity Used</th><th data-usage-column="recorded-by">Recorded By</th></tr></thead>
                <tbody>
                  {usageData?.items.map(record => <tr key={record.id}><td data-usage-column="date-time"><time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time></td><td data-usage-column="ingredient" className="sl-emphasized-value" title={record.ingredient.name}>{record.ingredient.name}</td><td data-usage-column="batch-id">{record.batch.batchID}</td><td data-usage-column="quantity">{record.quantityUsed} {record.unit}</td><td data-usage-column="recorded-by">{record.recordedBy.name}</td></tr>)}
                  {!usageLoading && !usageError && (!usageData || usageData.items.length === 0) && <tr className="sl-sa-records-dash-row sl-staff-records-dash-row">{Array.from({length:5}).map((_,index)=><td key={index}>—</td>)}</tr>}
                  {usageLoading && <tr className="sl-sa-records-dash-row sl-staff-records-dash-row">{Array.from({length:5}).map((_,index)=><td key={index}>Loading…</td>)}</tr>}
                  {usageError && <tr className="sl-sa-records-dash-row sl-staff-records-dash-row">{Array.from({length:5}).map((_,index)=><td key={index}>Data unavailable</td>)}</tr>}
                </tbody>
              </table>
            </div>
            <footer className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={rowsPerPage} onChange={e=>{setRowsPerPage(e.target.value);setUsagePage(1)}}>{['10','15','50','100','150'].map(n=><option key={n}>{n}</option>)}</select></label>
              <Pagination compact page={usagePage} pageSize={Number(rowsPerPage)} total={usageData?.total ?? 0} itemLabel="usage records" onPageChange={setUsagePage} />
            </footer>
          </section>
      </div>
    </div>

    <Dialog open={addUsageOpen} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><FileInput size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Record Usage</span><small>Record ingredient consumption from an inventory batch.</small></span></span>} className="sl-add-user-dialog sl-account-reference-dialog sl-usage-entry-modal" onDismiss={()=>{clearForm();setAddUsageOpen(false)}} returnFocus={addUsageButton} actions={<span className="sl-creation-form-actions"><button type="button" className="sl-button" onClick={()=>{clearForm();setAddUsageOpen(false)}}>Cancel</button><button type="submit" form="sl-usage-entry-form" className="sl-button sl-button-primary">Save Usage Record</button></span>}>
      <form id="sl-usage-entry-form" ref={usageForm} className="sl-usage-entry-form sl-creation-form" noValidate onSubmit={submitUsage}>
        <div className="sl-creation-form-grid">
          <div className="sl-creation-form-row">
            <label className="sl-creation-form-field"><span>Ingredient</span><select value={ingredientId} onChange={event=>{setIngredientId(event.target.value);setBatchId('');clearUsageError('ingredientId');clearUsageError('batchId')}} {...usageValidation('ingredientId')}><option value="">Search or select ingredient...</option>{usageIngredients.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select>{renderUsageError('ingredientId')}</label>
            <label className="sl-creation-form-field"><span>Batch ID</span><select value={batchId} disabled={!ingredientId} onChange={event=>{setBatchId(event.target.value);clearUsageError('batchId')}} {...usageValidation('batchId')}><option value="">Select batch...</option>{usageBatches.map(value=><option key={value.id} value={value.id}>{value.batchID}</option>)}</select>{renderUsageError('batchId')}</label>
          </div>
          <div className="sl-creation-form-row">
            <label className="sl-creation-form-field"><span>Date Used</span><input type="date" value={dateUsed} onChange={event=>{setDateUsed(event.target.value);clearUsageError('dateUsed')}} {...usageValidation('dateUsed')} />{renderUsageError('dateUsed')}</label>
            <label className="sl-creation-form-field"><span>Quantity Used</span><input inputMode="decimal" value={quantity} onChange={event=>{setQuantity(event.target.value);clearUsageError('quantity')}} placeholder="Enter quantity" {...usageValidation('quantity')} />{renderUsageError('quantity')}</label>
          </div>
          <div className="sl-creation-form-row"><label className="sl-creation-form-field sl-usage-entry-unit"><span>Unit</span><output className="sl-staff-derived-unit" aria-label={selectedUsageBatch ? 'Unit derived from selected inventory batch' : selectedUsageIngredient ? 'Unit derived from selected ingredient' : 'Unit will be derived from the selected inventory batch'}>{selectedUsageBatch?.unit ?? selectedUsageIngredient?.unitOfMeasure ?? '—'}</output></label></div>
        </div>
        {usageMessage&&<p className="sl-inline-notice sl-usage-entry-message" role="status">{usageMessage}</p>}
      </form>
    </Dialog>
  </>;
}


const inventoryBatchStatusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired' ? 'critical' as const : status === 'Near Expiry' || status === 'Low Stock' ? 'attention' as const : 'success' as const;

export function InventoryBatchDetailsDialog({ batch, onDismiss, returnFocus }: { batch: InventoryBatch | null; onDismiss: () => void; returnFocus?: RefObject<HTMLElement | null> }) {
  return <Dialog open={Boolean(batch)} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Boxes size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Inventory Batch Details</span><small>View inventory batch information.</small></span></span>} onDismiss={onDismiss} returnFocus={returnFocus} actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>} className="sl-account-reference-dialog sl-inventory-batch-details-dialog">
    {batch && <dl className="sl-inventory-batch-details-grid">
      <div><dt>Batch ID</dt><dd>{batch.batchID}</dd></div><div><dt>Ingredient</dt><dd>{batch.ingredient.name}</dd></div>
      <div><dt>Date Received</dt><dd>{formatDate(batch.dateReceived)}</dd></div><div><dt>Expiration Date</dt><dd>{formatDate(batch.expirationDate)}</dd></div>
      <div><dt>Current Stock</dt><dd>{batch.quantity.toLocaleString()}</dd></div><div><dt>Unit</dt><dd>{batch.unit}</dd></div>
      <div><dt>Days Left</dt><dd>{batch.daysLeft}</dd></div><div><dt>Status</dt><dd><Status tone={inventoryBatchStatusTone(batch.displayStatus)}>{batch.displayStatus}</Status></dd></div>
      <div className="sl-inventory-batch-details-wide"><dt>Recorded By</dt><dd>{batch.createdBy.name}</dd></div>
    </dl>}
  </Dialog>;
}

function InventoryStaffStockInPage() {
  type StockInField = 'dateReceived' | 'ingredientId' | 'quantity' | 'expirationDate' | 'unitCost';
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [stockIngredient, setStockIngredient] = useState('All Ingredients');
  const [stockIngredients, setStockIngredients] = useState<StockInIngredient[]>([]);
  const [stockDateRange, setStockDateRange] = useState('All dates');
  const [stockDateFrom, setStockDateFrom] = useState('');
  const [stockDateTo, setStockDateTo] = useState('');
  const [stockRows, setStockRows] = useState(10);
  const [stockPage, setStockPage] = useState(1);
  const [stockData, setStockData] = useState<{items:InventoryBatch[];total:number}|null>(null);
  const [stockSummary, setStockSummary] = useState<StockInSummary|null>(null);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState(false);
  const [stockFormMessage, setStockFormMessage] = useState('');
  const [stockErrors, setStockErrors] = useState<Partial<Record<StockInField, string>>>({});
  const [stockBusy, setStockBusy] = useState(false);
  const [dateReceived, setDateReceived] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [viewBatch, setViewBatch] = useState<InventoryBatch|null>(null);
  const viewBatchTrigger = useRef<HTMLTableRowElement>(null);
  const addStockInButton = useRef<HTMLButtonElement>(null);
  const stockForm = useRef<HTMLFormElement>(null);
  const selectedIngredient = stockIngredients.find(item => item.id === ingredientId);
  const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const minimumExpiryDate = dateReceived ? (() => { const value=new Date(`${dateReceived}T00:00:00`);value.setDate(value.getDate()+1);return dateValue(value); })() : undefined;
  const range = (() => { if(stockDateRange==='All dates') return {}; if(stockDateRange==='Custom range') return {from:stockDateFrom,to:stockDateTo}; const days=stockDateRange==='Today'?1:stockDateRange==='Last 30 Days'?30:7; const to=new Date(),from=new Date();from.setDate(from.getDate()-(days-1));return {from:dateValue(from),to:dateValue(to)}; })();
  const clearForm=()=>{setDateReceived('');setIngredientId('');setQuantity('');setExpirationDate('');setUnitCost('');setStockErrors({});setStockFormMessage('')};
  const clearStockError=(field:StockInField)=>{setStockErrors(current=>({...current,[field]:undefined}));setStockFormMessage('')};
  const stockValidation=(field:StockInField)=>({
    'aria-invalid':stockErrors[field]?true as const:undefined,
    'aria-describedby':stockErrors[field]?`stockin-${field}-error`:undefined,
  });
  const renderStockError=(field:StockInField)=>stockErrors[field]?<span id={`stockin-${field}-error`} className="sl-field-error">{stockErrors[field]}</span>:null;
  useEffect(() => { const controller=new AbortController(); listStockInIngredients(controller.signal).then(result=>setStockIngredients(result.ingredients)).catch(()=>{if(!controller.signal.aborted)setStockIngredients([])}); return()=>controller.abort(); }, []);
  useEffect(() => {
    const controller=new AbortController();setStockLoading(true);setStockError(false);
    Promise.all([listInventoryBatches({page:stockPage,pageSize:stockRows,...(stockSearch.trim()?{search:stockSearch.trim()}:{}),...(stockIngredient!=='All Ingredients'?{ingredientId:stockIngredient}:{}),...(range.from?{from:range.from}:{}),...(range.to?{to:range.to}:{})},controller.signal),getStockInSummary(controller.signal)])
      .then(([data,summary])=>{setStockData(data);setStockSummary(summary)}).catch(()=>{if(!controller.signal.aborted)setStockError(true)}).finally(()=>{if(!controller.signal.aborted)setStockLoading(false)});
    return()=>controller.abort();
  },[stockSearch,stockIngredient,stockDateRange,stockDateFrom,stockDateTo,stockRows,stockPage]);
  useEffect(()=>{ if(!dateReceived||!selectedIngredient?.defaultShelfLifeDays)return; const suggested=new Date(`${dateReceived}T00:00:00`);suggested.setDate(suggested.getDate()+selectedIngredient.defaultShelfLifeDays);setExpirationDate(dateValue(suggested));setStockErrors(current=>({...current,expirationDate:undefined})); },[dateReceived,ingredientId]);
  useEffect(()=>{setUnitCost(selectedIngredient?.standardUnitCost===undefined?'':String(selectedIngredient.standardUnitCost));setStockErrors(current=>({...current,unitCost:undefined}))},[ingredientId]);
  const submitStockIn=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setStockFormMessage('');const next:Partial<Record<StockInField,string>>={};if(!dateReceived)next.dateReceived='Select the date received.';if(!ingredientId)next.ingredientId='Select an ingredient.';if(!quantity)next.quantity='Enter the quantity received.';if(!expirationDate)next.expirationDate='Select the expiration date.';const numericQuantity=Number(quantity),numericCost=unitCost===''?undefined:Number(unitCost);if(quantity&&(!Number.isFinite(numericQuantity)||numericQuantity<=0))next.quantity='Enter a quantity greater than 0.';if(unitCost!==''&&!Number.isFinite(numericCost))next.unitCost='Enter a valid unit cost.';else if(numericCost!==undefined&&numericCost<0)next.unitCost='Enter a unit cost of 0 or more.';if(Object.keys(next).length){setStockErrors(next);requestAnimationFrame(()=>stockForm.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());return}setStockBusy(true);setStockErrors({});try{const batch=await createStockIn({ingredientId,dateReceived,quantity:numericQuantity,expirationDate,...(numericCost===undefined?{}:{unitCost:numericCost})});setStockFormMessage(`Stock-In saved. Batch ID: ${batch.batchID}`);clearForm();setAddModalOpen(false);const [data,summary]=await Promise.all([listInventoryBatches({page:1,pageSize:stockRows,from:range.from,to:range.to}),getStockInSummary()]);setStockPage(1);setStockData(data);setStockSummary(summary)}catch(error){if(error instanceof ApiError){const fieldErrors:Partial<Record<StockInField,string>>={};for(const detail of error.details){if(['dateReceived','ingredientId','quantity','expirationDate','unitCost'].includes(detail.field))fieldErrors[detail.field as StockInField]=detail.field==='expirationDate'&&detail.message==='Expiration date must be after date received'?'Expiration date must be after the date received.':detail.message}setStockErrors(fieldErrors);setStockFormMessage(Object.keys(fieldErrors).length?'':error.message)}else setStockFormMessage('Unable to save Stock-In. Try again.')}finally{setStockBusy(false)}};
  const metric=(value:number|undefined)=>stockError&&!stockSummary?'Unavailable':stockLoading&&!stockSummary?'—':(value??0).toLocaleString();
  const reset=()=>{setStockSearch('');setStockIngredient('All Ingredients');setStockDateRange('All dates');setStockDateFrom('');setStockDateTo('');setStockPage(1)};
  return <>
    <PageHeader eyebrow="Inventory" title="Stock-In" description="Receive and record inventory batches for existing ingredients." />
    <div className="sl-admin-view sl-staff-stockin-v145">
      <div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-stockin-kpis sl-superadmin-dashboard-kpis-v201 sl-staff-usage-kpis" aria-label="Stock-in summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Truck aria-hidden="true" /></span><div><span>Stock-In Today</span><strong>{metric(stockSummary?.stockInToday)}</strong><small>{stockSummary?.stockInToday===1?'Batch received today':'Batches received today'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Ingredients Received Today</span><strong>{metric(stockSummary?.ingredientsReceivedToday)}</strong><small>{stockSummary?.ingredientsReceivedToday===1?'Distinct ingredient received today':'Distinct ingredients received today'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><ClipboardCheck aria-hidden="true" /></span><div><span>Batches Received This Month</span><strong>{metric(stockSummary?.batchesReceivedThisMonth)}</strong><small>Batches received this month</small></div></article>
      </section></div>
      <div className="sl-staff-stockin-layout"><main className="sl-staff-stockin-main"><section className="sl-application-records sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records sl-staff-stockin-history" aria-labelledby="staff-stockin-history-title">
        <header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><Clock3 aria-hidden="true" /></span><h2 id="staff-stockin-history-title">Stock-In Records</h2></header>
        <div className="sl-sa-ingredients-table-filters"><div className="sl-sa-ingredients-filter-card sl-staff-stockin-history-filters">
          <label className="sl-sa-ingredients-search"><span>Search records</span><div><Search size={16} aria-hidden="true" /><input value={stockSearch} onChange={event=>{setStockSearch(event.target.value);setStockPage(1)}} placeholder="Search by ingredient or Batch ID..." /></div></label>
          <label><span>Ingredient</span><select value={stockIngredient} onChange={event=>{setStockIngredient(event.target.value);setStockPage(1)}}><option>All Ingredients</option>{stockIngredients.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label><span>Date range</span><select value={stockDateRange} onChange={event=>{setStockDateRange(event.target.value);setStockPage(1)}}>{STOCK_IN_DATE_RANGES.map(value=><option key={value}>{value}</option>)}</select></label>
          {stockDateRange==='Custom range'&&<div className="sl-v219-custom-date-range" aria-label="Custom stock-in date range"><label><span>From</span><input type="date" value={stockDateFrom} max={stockDateTo||undefined} onChange={event=>{setStockDateFrom(event.target.value);setStockPage(1)}}/></label><label><span>To</span><input type="date" value={stockDateTo} min={stockDateFrom||undefined} onChange={event=>{setStockDateTo(event.target.value);setStockPage(1)}}/></label></div>}
          <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={reset}>Reset</button><InventoryStaffAddButton buttonRef={addStockInButton} label="Add Stock-In" onClick={()=>setAddModalOpen(true)} /></div>
        </div></div>
        <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell"><table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-staff-stockin-table"><thead><tr>{['Recorded At','Date Received','Ingredient','Batch ID','Quantity','Unit','Expiration Date','Recorded By'].map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>
          {stockLoading&&!stockData?<tr><td colSpan={8} className="sl-empty-cell"><DataState kind="loading" title="Loading Stock-In records" description="Retrieving received inventory batches."/></td></tr>:stockError?<tr><td colSpan={8} className="sl-empty-cell"><DataState kind="error" title="Stock-In records unavailable" description="The inventory service could not be reached."/></td></tr>:!stockData?.items.length?<tr><td colSpan={8} className="sl-empty-cell"><DataState kind="empty" title={stockSummary?.totalBatches?'No matching records':'No live records yet'} description={stockSummary?.totalBatches?'No Stock-In records match the current search and filters.':'Stock-In records will appear here after inventory is received.'}/></td></tr>:stockData.items.map(batch=><tr key={batch.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{viewBatchTrigger.current=event.currentTarget;setViewBatch(batch)}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();viewBatchTrigger.current=event.currentTarget;setViewBatch(batch)}}}><td>{formatDateTime(batch.createdAt)}</td><td>{formatDate(batch.dateReceived)}</td><td className="sl-emphasized-value">{batch.ingredient.name}</td><td><button type="button" className="sl-record-identifier-link" onClick={event=>{event.stopPropagation();viewBatchTrigger.current=event.currentTarget.closest('tr');setViewBatch(batch)}}>{batch.batchID}</button></td><td>{batch.quantity.toLocaleString()}</td><td>{batch.unit}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.createdBy.name}</td></tr>)}
        </tbody></table></div>
        <footer className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer"><label><span>Rows per page</span><select value={stockRows} onChange={event=>{setStockRows(Number(event.target.value));setStockPage(1)}}>{[10,15,50,100,150].map(value=><option key={value}>{value}</option>)}</select></label><Pagination compact page={stockPage} pageSize={stockRows} total={stockData?.total??0} itemLabel="stock-in records" onPageChange={setStockPage}/></footer>
      </section></main></div>
    </div>
    <Dialog open={addModalOpen} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><PackagePlus size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Add Stock-In</span><small>Record a received inventory batch.</small></span></span>} busy={stockBusy} className="sl-add-user-dialog sl-account-reference-dialog sl-stockin-entry-modal" onDismiss={()=>{if(!stockBusy){clearForm();setAddModalOpen(false)}}} returnFocus={addStockInButton} actions={<span className="sl-creation-form-actions"><button type="button" className="sl-button" disabled={stockBusy} onClick={()=>{clearForm();setAddModalOpen(false)}}>Cancel</button><button type="submit" form="sl-stockin-entry-form" className="sl-button sl-button-primary" disabled={stockBusy}>Save Stock-In</button></span>}>
      <form id="sl-stockin-entry-form" ref={stockForm} className="sl-stockin-entry-form sl-creation-form" noValidate onSubmit={submitStockIn}>
        <div className="sl-creation-form-grid">
          <div className="sl-creation-form-row">
            <label className="sl-creation-form-field"><span>Date Received</span><input type="date" value={dateReceived} onChange={event=>{setDateReceived(event.target.value);clearStockError('dateReceived')}} {...stockValidation('dateReceived')} />{renderStockError('dateReceived')}</label>
            <label className="sl-creation-form-field"><span>Ingredient</span><select value={ingredientId} onChange={event=>{setIngredientId(event.target.value);clearStockError('ingredientId')}} {...stockValidation('ingredientId')}><option value="">Search or select ingredient...</option>{stockIngredients.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}</select>{renderStockError('ingredientId')}</label>
          </div>
          <div className="sl-creation-form-row">
            <label className="sl-creation-form-field"><span>Quantity Received</span><input inputMode="decimal" value={quantity} onChange={event=>{setQuantity(event.target.value);clearStockError('quantity')}} placeholder="Enter quantity" {...stockValidation('quantity')} />{renderStockError('quantity')}</label>
            <label className="sl-creation-form-field"><span>Unit</span><output className="sl-staff-derived-unit" aria-label={selectedIngredient?'Unit derived from selected ingredient':'Unit will be derived from the selected ingredient'}>{selectedIngredient?.unitOfMeasure??'—'}</output></label>
          </div>
          <div className="sl-creation-form-row">
            <label className="sl-creation-form-field"><span>Expiration Date</span><input type="date" min={minimumExpiryDate} value={expirationDate} onChange={event=>{setExpirationDate(event.target.value);clearStockError('expirationDate')}} {...stockValidation('expirationDate')} />{renderStockError('expirationDate')}</label>
            <label className="sl-creation-form-field"><span>Unit Cost (Optional)</span><span className="sl-currency-input sl-stockin-currency-input"><span aria-hidden="true">₱</span><input inputMode="decimal" value={unitCost} onChange={event=>{setUnitCost(event.target.value);clearStockError('unitCost')}} placeholder="0.00" aria-label="Unit Cost in Philippine pesos" {...stockValidation('unitCost')} /></span>{renderStockError('unitCost')}</label>
          </div>
        </div>
        {stockFormMessage&&<p className="sl-inline-notice sl-stockin-entry-message" role="status">{stockFormMessage}</p>}
      </form>
    </Dialog>
    <InventoryBatchDetailsDialog batch={viewBatch} onDismiss={()=>setViewBatch(null)} returnFocus={viewBatchTrigger} />
  </>;
}

function InventoryStaffInventoryBatchesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesUnavailable, setCategoriesUnavailable] = useState(false);
  const [batchStatus, setBatchStatus] = useState('');
  const [sortBy, setSortBy] = useState('FEFO (Earliest Expiry)');
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const [batchData, setBatchData] = useState<{ items: InventoryBatch[]; total: number } | null>(null);
  const [batchSummary, setBatchSummary] = useState<InventoryBatchSummary | null>(null);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState(false);
  const [batchSummaryError, setBatchSummaryError] = useState(false);
  const [viewBatch, setViewBatch] = useState<InventoryBatch | null>(null);
  const viewBatchTrigger = useRef<HTMLTableRowElement>(null);
  const reset = () => {
    setSearch('');
    setCategory('');
    setBatchStatus('');
    setSortBy('FEFO (Earliest Expiry)');
  };
  useEffect(() => {
    const controller = new AbortController();
    listIngredientCategories(controller.signal)
      .then(result => { setCategories(result.categories); setCategoriesUnavailable(false); })
      .catch(error => { if (error?.name !== 'AbortError') { setCategories([]); setCategoriesUnavailable(true); } });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBatchLoading(true); setBatchError(false); setBatchSummaryError(false);
    const sort = sortBy === 'FEFO (Earliest Expiry)' ? 'fefo' as const : sortBy === 'Latest Received' ? 'latest' as const : sortBy === 'Ingredient Name' ? 'ingredient' as const : undefined;
    const query = { page, pageSize: rows, ...(search.trim() ? { search: search.trim() } : {}), ...(category ? { category } : {}), ...(batchStatus ? { status: batchStatus as InventoryBatchDisplayStatus } : {}), ...(sort ? { sort } : {}) };
    listInventoryBatches(query, controller.signal)
      .then(records => { if (!controller.signal.aborted) setBatchData(records); })
      .catch(() => { if (!controller.signal.aborted) setBatchError(true); })
      .finally(() => { if (!controller.signal.aborted) setBatchLoading(false); });
    getInventoryBatchSummary(controller.signal)
      .then(summary => { if (!controller.signal.aborted) setBatchSummary(summary); })
      .catch(() => { if (!controller.signal.aborted) setBatchSummaryError(true); });
    return () => controller.abort();
  }, [page, rows, search, category, batchStatus, sortBy]);
  const kpiValue = (value: number | undefined) => batchLoading && !batchSummary ? '—' : batchError && !batchSummary ? '—' : (value ?? 0).toLocaleString();
  return <>
    <PageHeader eyebrow="Inventory" title="Inventory Batches" description="View and monitor all ingredient batches. Check stock levels, expiration dates, and FEFO order." />

    <div className="sl-admin-view sl-staff-inventory-v149">
      <div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150">
        <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-inventory-kpis sl-superadmin-dashboard-kpis-v201 sl-staff-usage-kpis" aria-label="Inventory batch summary">
          <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Batches</span><strong>{kpiValue(batchSummary?.totalBatches)}</strong><small>{batchSummaryError ? 'Batch service unavailable' : 'Inventory batch records'}</small></div></article>
          <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Batches Near Expiry (≤ 7 days)</span><strong>{kpiValue(batchSummary?.nearExpiry)}</strong><small>{batchSummaryError ? 'Expiration service unavailable' : 'Batches expiring within seven days'}</small></div></article>
          <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Low Stock Items</span><strong>{kpiValue(batchSummary?.lowStockItems)}</strong><small>{batchSummaryError ? 'Stock summary unavailable' : 'Ingredients at or below minimum stock'}</small></div></article>
          <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Expired Batches</span><strong>{kpiValue(batchSummary?.expiredItems)}</strong><small>{batchSummaryError ? 'Expiration service unavailable' : 'Batches past their expiration date'}</small></div></article>
        </section>
      </div>

      <div className="sl-staff-inventory-layout">
        <main className="sl-staff-inventory-main">
          <section className="sl-application-records sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records sl-staff-inventory-records" aria-labelledby="staff-inventory-batches-title">
            <header className="sl-application-records-header sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-application-records-icon sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2 id="staff-inventory-batches-title">Inventory Batches</h2>
            </header>

            <div className="sl-application-records-filters sl-sa-ingredients-table-filters">
              <div className="sl-application-records-toolbar sl-sa-ingredients-filter-card sl-staff-inventory-record-filters" data-layout="inventory-staff">
                <label className="sl-application-records-search sl-sa-ingredients-search"><span>Search batches</span><div><Search size={16} aria-hidden="true"/><input type="search" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search ingredient or batch ID..." aria-label="Search inventory batches" /></div></label>
                <label><span>Category</span><select value={category} title={categoriesUnavailable ? 'Category options are unavailable' : undefined} onChange={e=>{ setCategory(e.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                <label><span>Status</span><select value={batchStatus} onChange={e=>{ setBatchStatus(e.target.value); setPage(1); }}><option value="">All Statuses</option><option value="In Stock">In Stock</option><option value="Low Stock">Low Stock</option><option value="Near Expiry">Near Expiry</option><option value="Expired">Expired</option></select></label>
                <label><span>Sort by</span><select value={sortBy} onChange={e=>{ setSortBy(e.target.value); setPage(1); }} aria-label="Sort inventory batches"><option>FEFO (Earliest Expiry)</option><option>Latest Received</option><option>Ingredient Name</option><option>None</option></select></label>
                <div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={()=>{ reset(); setPage(1); }}>Reset</button></div>
              </div>
            </div>

            <div className="sl-application-records-table-shell sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Inventory Batches preview" tabIndex={0}>
              <table className="sl-application-records-table sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-staff-inventory-records-table">
                <thead><tr>{['Ingredient','Batch ID','Category','Date Received','Expiration Date','Days Left','Current Stock','Unit','Status'].map(column=><th scope="col" key={column}>{column}</th>)}</tr></thead>
                <tbody>{batchLoading && !batchData ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="loading" title="Loading inventory batches" description="Retrieving current inventory records." /></td></tr> : batchError ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="error" title="Inventory batches unavailable" description="The inventory service could not be reached." /></td></tr> : !batchData?.items.length ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="empty" title={search || category || batchStatus ? 'No matching records' : 'No inventory batches yet'} description={search || category || batchStatus ? 'Try adjusting the current filters.' : 'Inventory batches will appear after stock is received.'} /></td></tr> : batchData.items.map(batch => <tr key={batch.id} className="sl-detail-enabled-row" role="button" tabIndex={0} onClick={event=>{viewBatchTrigger.current=event.currentTarget;setViewBatch(batch)}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();viewBatchTrigger.current=event.currentTarget;setViewBatch(batch)}}}><td><span className="sl-emphasized-value">{batch.ingredient.name}</span></td><td><button type="button" className="sl-record-identifier-link" onClick={event=>{event.stopPropagation();viewBatchTrigger.current=event.currentTarget.closest('tr');setViewBatch(batch)}}>{batch.batchID}</button></td><td>{batch.ingredient.category}</td><td>{formatDate(batch.dateReceived)}</td><td>{formatDate(batch.expirationDate)}</td><td>{batch.daysLeft}</td><td>{batch.quantity.toLocaleString()}</td><td>{batch.unit}</td><td><Status tone={inventoryBatchStatusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td></tr>)}</tbody>
              </table>
            </div>

            <footer className="sl-application-records-footer sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={rows} aria-label="Rows per page" onChange={event => { setRows(Number(event.target.value)); setPage(1); }}><option>10</option><option>15</option><option>50</option><option>100</option><option>150</option></select></label>
              <Pagination compact page={page} pageSize={rows} total={batchData?.total ?? 0} itemLabel="batch records" onPageChange={setPage} />
            </footer>
          </section>
        </main>


      </div>
    </div>
    <InventoryBatchDetailsDialog batch={viewBatch} onDismiss={()=>setViewBatch(null)} returnFocus={viewBatchTrigger} />
  </>;
}

function ManagerInventoryPage() {
  const [category, setCategory] = useState('All Categories');
  const [status, setStatus] = useState('All Statuses');
  const [expiration, setExpiration] = useState('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All Items');
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const reset = () => { setCategory('All Categories'); setStatus('All Statuses'); setExpiration('All'); setSearch(''); setTab('All Items'); };
  return <>
    <PageHeader eyebrow="Inventory" title="Inventory" description="Monitor stock levels, expiration dates, and FEFO priority for your branch." />
    <div className="sl-admin-view sl-manager-inventory-v119">
      <div className="sl-sa-kpis sl-admin-reference-kpis sl-manager-inventory-kpis sl-kpi-reference-v201" aria-label="Inventory summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Stock Items</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Items Near Expiry (≤ 7 days)</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PackageX /></span><div><span>Low Stock Items</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Total Inventory Value</span><strong>—</strong><small>Data unavailable</small></div></article>
      </div>
      <section className="sl-manager-inventory-directory sl-reference-records" aria-label="Inventory directory">
        <header className="sl-reference-records-heading"><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span><strong>Inventory Records</strong></header>
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
          <table className="sl-data-table sl-manager-inventory-table sl-reference-records-table" aria-label="Inventory items"><thead><tr>{['Ingredient','Batch ID','Category','Current Stock','Unit','Expiration Date','Days Left','Status','Supplier','Actions'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody><tr aria-label="Inventory values unavailable">{Array.from({length:10}).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table>
        </div>
        <div className="sl-manager-inventory-footer sl-reference-records-footer"><label>Rows per page <select className="sl-admin-input" value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{[10,15,50,100,150].map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={0} itemLabel="inventory records" onPageChange={setPage} /></div>
      </section>
      <div className="sl-manager-inventory-lower-grid">
        <section className="sl-manager-inventory-panel sl-reference-records"><header><div><strong><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>FEFO Priority</strong><small>Top batches to use first (First Expire, First Out)</small></div><Link href="/Inventory" className="sl-text-link">View All <ArrowRight size={14}/></Link></header><div className="sl-manager-inventory-table-shell"><table className="sl-data-table sl-reference-records-table" aria-label="FEFO priority batches"><thead><tr>{['Ingredient','Batch ID','Expiration Date','Days Left','Priority'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody><tr aria-label="FEFO priority values unavailable">{Array.from({length:5}).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table></div></section>
        <section className="sl-manager-inventory-panel"><header><strong>Inventory by Category</strong><Link href="/ReportsAnalytics" className="sl-text-link">View Details <ArrowRight size={14}/></Link></header><div className="sl-manager-panel-empty"><DataState kind="empty" title="Category distribution unavailable" description="Category distribution requires live inventory records." /></div></section>
      </div>
    </div>
  </>;
}

function IngredientsAdminPage({ preview, setPreview }: { preview: PreviewId | null; setPreview: (value: PreviewId | null) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [unitFilter, setUnitFilter] = useState('All Units');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: Ingredient[]; page: number; pageSize: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ total: number; categories: string[]; units: string[]; mostCommonIngredient: string | null } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<IngredientDraft>(emptyIngredient);
  const [errors, setErrors] = useState<Partial<Record<IngredientField, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
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
      listIngredients(page, pageSize, search.trim(), category === 'All' ? '' : category, abort.signal, unitFilter === 'All Units' ? '' : unitFilter).then(value => {
        if (!abort.signal.aborted) setData(value);
      }).catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    }, 250);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [page, pageSize, search, category, unitFilter, refresh]);
  useEffect(() => {
    const abort = new AbortController();
    getIngredientSummary(abort.signal).then(value => { if (!abort.signal.aborted) setSummary(value); }).catch(() => { if (!abort.signal.aborted) setSummary(null); });
    return () => abort.abort();
  }, [refresh]);
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
    if (!editIngredient && clean.minStock === '') next.minStock = 'Enter the minimum stock amount.';
    if (!editIngredient && clean.shelfLife === '') next.shelfLife = 'Enter the default shelf life.';
    if (clean.minStock !== '' && (!Number.isFinite(Number(clean.minStock)) || Number(clean.minStock) < 0 || Number(clean.minStock) > 1_000_000_000)) next.minStock = 'Minimum stock must be between 0 and 1,000,000,000.';
    const unitCostValidationError = ingredientUnitCostFormError(clean.unitCost, !editIngredient);
    if (unitCostValidationError) next.unitCost = unitCostValidationError;
    if (clean.shelfLife !== '' && (!Number.isInteger(Number(clean.shelfLife)) || Number(clean.shelfLife) < 1 || Number(clean.shelfLife) > 3650)) next.shelfLife = 'Shelf life must be a whole number from 1 to 3,650 days.';
    if (Object.keys(next).length) {
      setErrors(next);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#sl-ingredient-form [aria-invalid="true"]')?.focus());
      return;
    }
    const unitCost = ingredientUnitCostApiValue(clean.unitCost);
    const input: IngredientInput = { name: clean.name, brand: clean.brand, description: clean.description, category: clean.category, unitOfMeasure: clean.unit, ...(clean.minStock === '' ? {} : { minimumStock: Number(clean.minStock) }), ...(unitCost === undefined ? {} : { standardUnitCost: unitCost }), ...(clean.shelfLife === '' ? {} : { defaultShelfLifeDays: Number(clean.shelfLife) }) };
    setBusy(true); setErrors({}); setFormError('');
    try {
      await (editIngredient ? updateIngredient(editIngredient.id, input) : createIngredient(input));
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
  const ingredientCategoryOptions = summary?.categories ?? [];
  const ingredientUnitOptions = summary?.units ?? [];
  const filteredIngredientItems = data?.items ?? [];
  return <>
    <PageHeader eyebrow="Core data" title="Ingredients" description="Manage ingredient master data used across your establishment." />
    <div className="sl-admin-view">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Ingredient summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Total Ingredients</span><strong>{summary ? summary.total.toLocaleString() : loadError ? 'Unavailable' : '—'}</strong><small>{summary ? 'Live ingredient catalogue' : loadError ? 'Ingredient API unavailable' : 'Loading live total'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Grid2X2 /></span><div><span>Categories</span><strong>{summary?.categories.length ?? '—'}</strong><small>{summary ? 'Distinct catalogue categories' : 'Live data pending'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Tag /></span><div><span>Most Common Ingredient</span><strong>{summary?.mostCommonIngredient ?? '—'}</strong><small>{summary?.mostCommonIngredient ? 'Based on recorded usage' : 'No usage records yet'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Ruler /></span><div><span>Distinct Units</span><strong>{summary?.units.length ?? '—'}</strong><small>{summary ? 'Units used in the catalogue' : 'Live data pending'}</small></div></article>
      </section>

      <section className="sl-application-records sl-admin-ingredient-records" aria-labelledby="admin-ingredient-records-title">
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileText aria-hidden="true" /></span><h2 id="admin-ingredient-records-title">Ingredient Records</h2></header>
        <div className="sl-application-records-filters"><div className="sl-application-records-toolbar" data-layout="ingredients" aria-label="Ingredient filters">
          <label className="sl-application-records-search"><span>Search ingredients</span><div><Search size={17}/><input type="search" placeholder="Search by ingredient name or category..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div></label>
          <label><span>Category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="All">All Categories</option>{ingredientCategoryOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          <label><span>Unit</span><select value={unitFilter} onChange={event => { setUnitFilter(event.target.value); setPage(1); }}><option>All Units</option>{ingredientUnitOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          <div className="sl-application-records-filter-actions"><button className="sl-button" type="button" onClick={() => { setSearch(''); setCategory('All'); setUnitFilter('All Units'); setPage(1); }}>Reset</button><button ref={addButtonRef} className="sl-button sl-button-primary" type="button" onClick={open}><Plus size={16}/>Add Ingredient</button></div>
        </div></div>
        <div className="sl-application-records-table-shell"><table className="sl-application-records-table" data-layout="ingredients"><thead><tr><th>#</th><th>Ingredient</th><th>Category</th><th>Unit</th><th>Default Shelf Life</th><th>Date Added</th><th>Actions</th></tr></thead><tbody>
          {loadError ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="error" title="Ingredients could not be loaded" description="The ingredient service is temporarily unavailable." action={<button type="button" className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
          : !data ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="loading" title="Loading ingredients" description="Retrieving live ingredient records." /></td></tr>
          : !filteredIngredientItems.length ? <tr><td colSpan={7} className="sl-empty-cell"><ApplicationPendingState className="sl-application-records-state" description={search || category !== 'All' || unitFilter !== 'All Units' ? 'No ingredients match the selected filters.' : 'Ingredient records will appear here once they are added.'} /></td></tr>
          : filteredIngredientItems.map((item, index) => <tr key={item.id}><td>{(data.page - 1) * data.pageSize + index + 1}</td><td><button className="sl-admin-ingredient-name sl-emphasized-value" type="button" title={item.name} onClick={() => setViewIngredient(item)}>{item.name}</button></td><td>{item.category}</td><td>{item.unitOfMeasure}</td><td>{item.defaultShelfLifeDays === undefined ? '—' : `${item.defaultShelfLifeDays} days`}</td><td><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td><td><div className="sl-ingredient-actions" aria-label={`Actions for ${item.name}`}><button type="button" className="sl-account-action sl-account-action-view" aria-label={`View ${item.name}`} title="View Ingredient" onClick={() => setViewIngredient(item)}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-account-action sl-account-action-edit" aria-label={`Edit ${item.name}`} title="Edit Ingredient" onClick={() => openEdit(item)}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-account-action sl-account-action-deactivate" aria-label={`Delete ${item.name}`} title="Delete Ingredient" onClick={() => setDeleteTarget(item)}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>)}
        </tbody></table></div>
        <footer className="sl-application-records-footer"><label><span>Rows per page</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="ingredients" onPageChange={setPage} /></footer>
      </section>
    </div>
    <Dialog open={preview === 'Ingredients'} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Leaf size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">{editIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}</span><small>{editIngredient ? 'Enter the ingredient details used across your establishment.' : 'Enter the ingredient details used across inventory workflows.'}</small></span></span>} onDismiss={dismiss} returnFocus={addButtonRef} busy={busy} className={`sl-add-user-dialog sl-account-reference-dialog sl-ingredient-reference-dialog sl-admin-ingredient-dialog sl-ingredient-create-dialog ${editIngredient ? 'sl-ingredient-edit-dialog' : 'sl-ingredient-add-dialog'}`} actions={<span className="sl-ingredient-create-actions"><button className="sl-button" type="button" disabled={busy} onClick={dismiss}>Cancel</button><button className="sl-button sl-button-primary" type="submit" form="sl-ingredient-form" disabled={busy}><CheckCircle2 size={16} aria-hidden="true" />{busy ? 'Saving…' : editIngredient ? 'Update Ingredient' : 'Save Ingredient'}</button></span>}>
      <IngredientForm form={form} errors={errors} busy={busy} formError={formError} set={setField} setError={setFieldError} canonicalModal showRequiredIndicators={false} reserveErrorSpace onSubmit={save} />
    </Dialog>
    <Dialog open={!!deleteTarget} showClose={false} title="Remove this ingredient?" confirmation={{ icon: <Trash2 />, description: <><strong>{deleteTarget?.name}</strong> will be removed from the catalogue.</> }} onDismiss={() => { if (!actionBusy) setDeleteTarget(null); }} busy={actionBusy} className="sl-logout-dialog sl-admin-ingredient-delete-dialog" actions={<><button className="sl-button sl-logout-stay" type="button" data-initial-focus disabled={actionBusy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="sl-button sl-button-logout" type="button" disabled={actionBusy} onClick={removeIngredient}>{actionBusy ? 'Removing…' : 'Remove Ingredient'}</button></>}>
      {deleteError && <p className="sl-field-error" role="alert">{deleteError}</p>}
    </Dialog>
    <Dialog open={!!viewIngredient} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Leaf size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Ingredient Details</span><small>Review the ingredient master-data record.</small></span></span>} onDismiss={() => setViewIngredient(null)} returnFocus={addButtonRef} className="sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog" actions={<><button type="button" className="sl-button" onClick={() => setViewIngredient(null)}>Close</button><button type="button" className="sl-button sl-button-primary" disabled={!viewIngredient} onClick={() => { if (viewIngredient) { const item = viewIngredient; setViewIngredient(null); openEdit(item); } }}><Pencil size={15} aria-hidden="true" /> Edit Ingredient</button></>}>
      {viewIngredient && <div className="sl-ingredient-details">
        <section className="sl-ingredient-details-identity" aria-labelledby="sl-ingredient-details-name"><div><h3 id="sl-ingredient-details-name">{viewIngredient.name}</h3><span className="sl-application-role-pill sl-account-details-role">{viewIngredient.category}</span></div></section>
        <section className="sl-ingredient-details-information" aria-labelledby="sl-ingredient-information-title">
          <h3 id="sl-ingredient-information-title">Ingredient Information</h3>
          <dl className="sl-ingredient-details-grid">
            <div><dt>Unit of Measure</dt><dd>{viewIngredient.unitOfMeasure}</dd></div>
            <div><dt>Minimum Stock</dt><dd>{viewIngredient.minimumStock === undefined ? '—' : `${viewIngredient.minimumStock} ${viewIngredient.unitOfMeasure}`}</dd></div>
            <div><dt>Standard Unit Cost</dt><dd>{viewIngredient.standardUnitCost === undefined ? '—' : `₱${viewIngredient.standardUnitCost.toFixed(2)}`}</dd></div>
            <div><dt>Default Shelf Life</dt><dd>{viewIngredient.defaultShelfLifeDays === undefined ? '—' : `${viewIngredient.defaultShelfLifeDays} days`}</dd></div>
            <div className="sl-ingredient-details-description"><dt>Description</dt><dd>{viewIngredient.description || '—'}</dd></div>
          </dl>
        </section>
      </div>}
    </Dialog>
  </>;
}


function SuperAdminIngredientPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-ingredients-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title={`${label} unavailable`}
      description="The supporting ingredient service is not connected yet."
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

  const formatUpdated = (value: string) => Number.isNaN(new Date(value).getTime()) ? 'Unavailable' : formatDateTime(value);

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
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-kpi-reference-v201" aria-label="Ingredient summary">
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
              </select>
            </label>

            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Status filter">
                <option>All Statuses</option>
              </select>
            </label>

            <div className="sl-sa-ingredients-filter-actions">
              <button type="button" className="sl-button" onClick={resetFilters}>Reset</button>
              <ExportControl label="Export" menuId="sl-sa-ingredients-export-menu" />
            </div>
              </div>

            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Live ingredient records" tabIndex={0}>
              <table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
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
                  {loadError || !data || data.items.length === 0 ? (
                    <tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Ingredient actions preview"><button type="button" className="sl-button sl-icon-button" aria-label="View ingredient" title="View" onClick={() => setPreviewAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button" aria-label="Edit ingredient" title="Edit" onClick={() => setPreviewAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-button sl-icon-button sl-staff-waste-delete" aria-label="Delete ingredient" title="Delete" onClick={() => setPreviewAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>
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

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
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
                {data && data.total > 0 ? `Showing ${visibleStart}–${visibleEnd} of ${data.total} ingredients` : 'Showing 0 to 0 of 0 ingredients'}
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

    <div className="sl-admin-view sl-sa-batches-page sl-sa-ingredients-page sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Inventory batch summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>—</strong><small>Awaiting inventory batch API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span><div><span>Active Batches</span><strong>—</strong><small>Awaiting batch status API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Expiring Soon</span><strong>—</strong><small>Awaiting expiration summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><PackageX aria-hidden="true" /></span><div><span>Expired Batches</span><strong>—</strong><small>Awaiting expiration summary API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-batches-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-batches-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Inventory batch records">
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
                <label><span>Ingredient</span><select value={batchIngredient} onChange={event => { setBatchIngredient(event.target.value); setBatchPage(1); }}><option>All Ingredients</option></select></label>
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
                  <tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row">
                    <td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td>
                    <td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Inventory batch actions preview"><button type="button" className="sl-icon-button" aria-label="View inventory batch" title="View" onClick={() => setBatchAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit inventory batch" title="Edit" onClick={() => setBatchAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete inventory batch" title="Delete" onClick={() => setBatchAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={batchRows} aria-label="Rows per page" onChange={event => { setBatchRows(Number(event.target.value)); setBatchPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
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
      title={`${label} unavailable`}
      description="The supporting usage service is not connected yet."
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
      <header className="sl-page-header sl-sa-usage-page-header">
        <p className="sl-eyebrow">System Oversight</p>
        <h1 className="sl-page-title">Usage</h1>
        <p
          className="sl-description sl-sa-usage-description"
          style={{ whiteSpace: 'nowrap', maxWidth: 'none', width: 'max-content' }}
        >
          View and monitor ingredient usage across all branches. Track consumption, support forecasting, and identify usage trends.
        </p>
      </header>
    </div>

    <div className="sl-admin-view sl-sa-usage-page sl-sa-ingredients-page sl-sa-usage-inventory-pattern sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Usage summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><UtensilsCrossed aria-hidden="true" /></span><div><span>Total Usage Records</span><strong>—</strong><small>Awaiting usage records API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span><div><span>Total Quantity Used</span><strong>—</strong><small>Awaiting consumption summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Building2 aria-hidden="true" /></span><div><span>Active Branches</span><strong>—</strong><small>Awaiting branch activity API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Users Recorded Usage</span><strong>—</strong><small>Awaiting recorder summary API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-usage-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-usage-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Usage records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Usage Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Usage filters">
                <label className="sl-sa-ingredients-search"><span>Search usage records</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by ingredient, batch ID, dish, or user…" value={usageSearch} onChange={event => { setUsageSearch(event.target.value); setUsagePage(1); }} /></div></label>
                <label><span>Ingredient</span><select value={usageIngredient} onChange={event => { setUsageIngredient(event.target.value); setUsagePage(1); }}><option>All Ingredients</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={usageDateRange} onChange={event => { setUsageDateRange(event.target.value); setUsagePage(1); }} aria-label="Usage date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {usageDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom usage date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={usageDateFrom} max={usageDateTo || undefined} onChange={event => { setUsageDateFrom(event.target.value); setUsagePage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={usageDateTo} min={usageDateFrom || undefined} onChange={event => { setUsageDateTo(event.target.value); setUsagePage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetUsageFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-usage-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Usage records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Date Used</th><th scope="col">Ingredient</th><th scope="col">Batch ID</th><th scope="col">Quantity Used</th><th scope="col">Recorded By</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Usage actions preview"><button type="button" className="sl-icon-button" aria-label="View usage record" title="View" onClick={() => setUsageAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit usage record" title="Edit" onClick={() => setUsageAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete usage record" title="Delete" onClick={() => setUsageAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={usageRows} aria-label="Rows per page" onChange={event => { setUsageRows(Number(event.target.value)); setUsagePage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
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
      title={`${label} unavailable`}
      description="The supporting waste service is not connected yet."
    />
  </div>;
}

function SuperAdminWastePage() {
  const [wasteSearch, setWasteSearch] = useState('');
  const [wasteIngredient, setWasteIngredient] = useState('All Ingredients');
  const [wasteReason, setWasteReason] = useState('All Reasons');
  const [wasteDateRange, setWasteDateRange] = useState('any');
  const [wasteDateFrom, setWasteDateFrom] = useState('');
  const [wasteDateTo, setWasteDateTo] = useState('');
  const [wasteRows, setWasteRows] = useState(10);
  const [wastePage, setWastePage] = useState(1);
  const [wasteAction, setWasteAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetWasteFilters = () => {
    setWasteSearch('');
    setWasteIngredient('All Ingredients');
    setWasteReason('All Reasons');
    setWasteDateRange('any');
    setWasteDateFrom('');
    setWasteDateTo('');
    setWastePage(1);
  };

  return <>
    <div className="sl-sa-waste-heading">
      <header className="sl-page-header sl-sa-waste-page-header">
        <p className="sl-eyebrow">System Oversight</p>
        <h1 className="sl-page-title">Waste</h1>
        <p
          className="sl-description sl-sa-waste-description"
          style={{ whiteSpace: 'nowrap', maxWidth: 'none', width: 'max-content' }}
        >
          Track and analyze wasted ingredients across all branches. Identify key causes and support waste reduction initiatives.
        </p>
      </header>
    </div>

    <div className="sl-admin-view sl-sa-waste-page sl-sa-ingredients-page sl-sa-waste-inventory-pattern sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Waste summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Trash2 aria-hidden="true" /></span><div><span>Total Waste</span><strong>—</strong><small>Awaiting waste volume API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span><div><span>Estimated Cost Loss</span><strong>—</strong><small>Awaiting waste valuation API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>Waste Records</span><strong>—</strong><small>Awaiting waste records API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><PackageX aria-hidden="true" /></span><div><span>Waste Rate</span><strong>—</strong><small>Awaiting waste-rate API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-waste-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-waste-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Waste records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Waste Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Waste filters">
                <label className="sl-sa-ingredients-search"><span>Search waste records</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by ingredient, batch ID, reason, or remarks…" value={wasteSearch} onChange={event => { setWasteSearch(event.target.value); setWastePage(1); }} /></div></label>
                <label><span>Ingredient</span><select value={wasteIngredient} onChange={event => { setWasteIngredient(event.target.value); setWastePage(1); }}><option>All Ingredients</option></select></label>
                <label><span>Reason</span><select value={wasteReason} onChange={event => { setWasteReason(event.target.value); setWastePage(1); }}><option>All Reasons</option><option>Expired</option><option>Spoiled</option><option>Trimming</option><option>Over-preparation</option><option>Damaged Packaging</option><option>Other</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={wasteDateRange} onChange={event => { setWasteDateRange(event.target.value); setWastePage(1); }} aria-label="Waste date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {wasteDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom waste date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={wasteDateFrom} max={wasteDateTo || undefined} onChange={event => { setWasteDateFrom(event.target.value); setWastePage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={wasteDateTo} min={wasteDateFrom || undefined} onChange={event => { setWasteDateTo(event.target.value); setWastePage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetWasteFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-waste-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Waste records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Date</th><th scope="col">Ingredient</th><th scope="col">Batch ID</th><th scope="col">Quantity Wasted</th><th scope="col">Reason</th><th scope="col">Recorded By</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Waste actions preview"><button type="button" className="sl-icon-button" aria-label="View waste record" title="View" onClick={() => setWasteAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit waste record" title="Edit" onClick={() => setWasteAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete waste record" title="Delete" onClick={() => setWasteAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={wasteRows} aria-label="Rows per page" onChange={event => { setWasteRows(Number(event.target.value)); setWastePage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <Pagination compact page={wastePage} pageSize={wasteRows} total={0} itemLabel="waste records" onPageChange={setWastePage} />
            </div>
          </section>
        </main>

        <aside className="sl-sa-waste-analytics-rail" aria-label="Waste analytics panels">
          <Card id="sa-waste-reason" title="Waste by Reason"><SuperAdminWastePending label="Waste distribution" compact /></Card>
          <Card id="sa-waste-trend" title="Waste Trend"><SuperAdminWastePending label="Waste trend" compact /></Card>
          <Card id="sa-waste-top-ingredients" title="Top Wasted Ingredients"><SuperAdminWastePending label="Wasted ingredients" compact /></Card>
          <Card id="sa-waste-recent-records" title="Recent Waste Records"><SuperAdminWastePending label="Waste activity" compact /></Card>
        </aside>
      </div>
    </div>

    <Dialog open={wasteAction!==null} title={wasteAction==='delete'?'Confirm Delete':wasteAction==='edit'?'Edit Waste Record':'Waste Record Details'} onDismiss={() => setWasteAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={wasteAction==='delete'?'A live waste record is required before deletion can be confirmed.':wasteAction==='edit'?'A live waste record is required before editing.':'Waste record details will appear here when live records are available.'} /></div>
      {wasteAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setWasteAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live waste record">Confirm Delete</button></div>}
    </Dialog>
  </>;
}


function SuperAdminChangeRequestsPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-change-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title={`${label} unavailable`}
      description="The supporting change-request service is not connected yet."
    />
  </div>;
}

function SuperAdminChangeRequestsPage() {
  const [requestSearch, setRequestSearch] = useState('');
  const [requestType, setRequestType] = useState('All Types');
  const [requestStatus, setRequestStatus] = useState('All Statuses');
  const [requestRole, setRequestRole] = useState('All Roles');
  const [requestDateRange, setRequestDateRange] = useState('any');
  const [requestDateFrom, setRequestDateFrom] = useState('');
  const [requestDateTo, setRequestDateTo] = useState('');
  const [requestRows, setRequestRows] = useState(10);
  const [requestPage, setRequestPage] = useState(1);
  const [requestAction, setRequestAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetRequestFilters = () => {
    setRequestSearch('');
    setRequestType('All Types');
    setRequestStatus('All Statuses');
    setRequestRole('All Roles');
    setRequestDateRange('any');
    setRequestDateFrom('');
    setRequestDateTo('');
    setRequestPage(1);
  };

  return <>
    <PageHeader
      eyebrow="System Oversight"
      title="Change Requests"
      description="Review and manage requests for changes to ingredients, inventory, and other master data."
    />

    <div className="sl-admin-view sl-sa-change-page sl-sa-batches-page sl-sa-ingredients-page sl-staff-usage-v150 sl-superadmin-dashboard-v49">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-sa-change-kpis sl-superadmin-dashboard-kpis-v200" aria-label="Change request summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileInput aria-hidden="true" /></span><div><span>Total Requests</span><strong>—</strong><small>Awaiting request-summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span><div><span>Approved</span><strong>—</strong><small>Awaiting approvals API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Pending Review</span><strong>—</strong><small>Awaiting review queue API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>Rejected</span><strong>—</strong><small>Awaiting decision API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-layout sl-sa-batches-ingredients-layout">
        <main className="sl-sa-ingredients-main sl-sa-batches-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Change request records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Change Request Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Change request filters">
                <label className="sl-sa-ingredients-search"><span>Search requests</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by request ID, ingredient, user, or details…" value={requestSearch} onChange={event => setRequestSearch(event.target.value)} /></div></label>
                <label><span>Request Type</span><select value={requestType} onChange={event => { setRequestType(event.target.value); setRequestPage(1); }}><option>All Types</option><option>Stock Adjustment</option><option>Usage Correction</option><option>Waste Correction</option></select></label>
                <label><span>Status</span><select value={requestStatus} onChange={event => { setRequestStatus(event.target.value); setRequestPage(1); }}><option>All Statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></label>
                <label><span>Requested By Role</span><select value={requestRole} onChange={event => { setRequestRole(event.target.value); setRequestPage(1); }}><option>All Roles</option><option>Admin</option><option>Manager</option><option>Inventory Staff</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={requestDateRange} onChange={event => { setRequestDateRange(event.target.value); setRequestPage(1); }} aria-label="Change request date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {requestDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom change request date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={requestDateFrom} max={requestDateTo || undefined} onChange={event => { setRequestDateFrom(event.target.value); setRequestPage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={requestDateTo} min={requestDateFrom || undefined} onChange={event => { setRequestDateTo(event.target.value); setRequestPage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetRequestFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-change-requests-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Change request records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Request ID</th><th scope="col">Request Type</th><th scope="col">Requested Change</th><th scope="col">Requested By</th><th scope="col">Date Requested</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Change request actions preview"><button type="button" className="sl-icon-button" aria-label="View change request" title="View" onClick={() => setRequestAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit change request" title="Edit" onClick={() => setRequestAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete change request" title="Delete" onClick={() => setRequestAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={requestRows} aria-label="Rows per page" onChange={event => { setRequestRows(Number(event.target.value)); setRequestPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <Pagination compact page={requestPage} pageSize={requestRows} total={0} itemLabel="change requests" onPageChange={setRequestPage} />
            </div>
          </section>
        </main>
      </div>
    </div>

    <Dialog open={requestAction!==null} title={requestAction==='delete'?'Confirm Delete':requestAction==='edit'?'Edit Change Request':'Change Request Details'} onDismiss={() => setRequestAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={requestAction==='delete'?'A live change request is required before deletion can be confirmed.':requestAction==='edit'?'A live change request is required before editing.':'Change request details will appear here when live records are available.'} /></div>
      {requestAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setRequestAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live change request">Confirm Delete</button></div>}
    </Dialog>
  </>;
}

function SuperAdminExpirationPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-expiration-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title={`${label} unavailable`}
      description="The supporting expiration service is not connected yet."
    />
  </div>;
}

export function SuperAdminExpirationMonitoringPage() {
  const [expirationSearch, setExpirationSearch] = useState('');
  const [expirationIngredient, setExpirationIngredient] = useState('All Ingredients');
  const [expirationStatus, setExpirationStatus] = useState('All Statuses');
  const [expirationDaysLeft, setExpirationDaysLeft] = useState('All Days Left');
  const [expirationDateRange, setExpirationDateRange] = useState('any');
  const [expirationDateFrom, setExpirationDateFrom] = useState('');
  const [expirationDateTo, setExpirationDateTo] = useState('');
  const [expirationRows, setExpirationRows] = useState(10);
  const [expirationPage, setExpirationPage] = useState(1);
  const [expirationAction, setExpirationAction] = useState<'view' | 'edit' | 'delete' | null>(null);

  const resetExpirationFilters = () => {
    setExpirationSearch('');
    setExpirationIngredient('All Ingredients');
    setExpirationStatus('All Statuses');
    setExpirationDaysLeft('All Days Left');
    setExpirationDateRange('any');
    setExpirationDateFrom('');
    setExpirationDateTo('');
    setExpirationPage(1);
  };

  return <>
    <div className="sl-sa-usage-heading">
      <header className="sl-page-header sl-sa-usage-page-header">
        <p className="sl-eyebrow">System Oversight</p>
        <h1 className="sl-page-title">Expiration / FEFO</h1>
        <p
          className="sl-description sl-sa-usage-description"
          style={{ whiteSpace: 'nowrap', maxWidth: 'none', width: 'max-content' }}
        >
          Monitor ingredient expiration dates and manage inventory using the FEFO (First-Expired, First-Out) approach.
        </p>
      </header>
    </div>

    <div className="sl-admin-view sl-sa-expiration-page sl-sa-usage-page sl-sa-ingredients-page sl-sa-usage-inventory-pattern sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Expiration monitoring summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes aria-hidden="true" /></span><div><span>Total Batches</span><strong>—</strong><small>Awaiting inventory batch API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2 aria-hidden="true" /></span><div><span>Good Shelf Life</span><strong>—</strong><small>Awaiting shelf-life summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Expiring (8–14 Days)</span><strong>—</strong><small>Awaiting expiry summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>Expired</span><strong>—</strong><small>Awaiting expired batch API</small></div></article>
      </section>

      <div className="sl-sa-expiration-layout sl-sa-ingredients-layout sl-sa-usage-ingredients-layout">
        <main className="sl-sa-expiration-main sl-sa-ingredients-main sl-sa-usage-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Expiration and FEFO records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head">
              <span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span>
              <h2>Expiration &amp; FEFO Records</h2>
            </header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Expiration monitoring filters">
                <label className="sl-sa-ingredients-search"><span>Search batches</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by batch ID or ingredient…" value={expirationSearch} onChange={event => setExpirationSearch(event.target.value)} /></div></label>
                <label><span>Ingredient</span><select value={expirationIngredient} onChange={event => { setExpirationIngredient(event.target.value); setExpirationPage(1); }}><option>All Ingredients</option></select></label>
                <label><span>Status</span><select value={expirationStatus} onChange={event => { setExpirationStatus(event.target.value); setExpirationPage(1); }}><option>All Statuses</option><option>Active</option><option>Expiring Soon</option><option>Expired</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><select value={expirationDateRange} onChange={event => { setExpirationDateRange(event.target.value); setExpirationPage(1); }} aria-label="Expiration date range"><option value="any">Any date</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {expirationDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom expiration date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={expirationDateFrom} max={expirationDateTo || undefined} onChange={event => { setExpirationDateFrom(event.target.value); setExpirationPage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={expirationDateTo} min={expirationDateFrom || undefined} onChange={event => { setExpirationDateTo(event.target.value); setExpirationPage(1); }} /></label></div>}
                <label><span>Days Left</span><select value={expirationDaysLeft} onChange={event => { setExpirationDaysLeft(event.target.value); setExpirationPage(1); }}><option>All Days Left</option><option>0 days</option><option>1–3 days</option><option>4–7 days</option><option>8–14 days</option><option>15+ days</option></select></label>
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetExpirationFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-expiration-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Expiration and FEFO records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Batch ID</th><th scope="col">Ingredient</th><th scope="col">Quantity</th><th scope="col">Expiration Date</th><th scope="col">Status</th><th scope="col">Days Left</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Expiration record actions preview"><button type="button" className="sl-icon-button" aria-label="View expiration record" title="View" onClick={() => setExpirationAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit expiration record" title="Edit" onClick={() => setExpirationAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete expiration record" title="Delete" onClick={() => setExpirationAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={expirationRows} aria-label="Rows per page" onChange={event => { setExpirationRows(Number(event.target.value)); setExpirationPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <Pagination compact page={expirationPage} pageSize={expirationRows} total={0} itemLabel="records" onPageChange={setExpirationPage} />
            </div>
          </section>
        </main>

        <aside className="sl-sa-expiration-rail sl-sa-usage-analytics-rail" aria-label="Expiration analytics panels">
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

    <Dialog open={expirationAction!==null} title={expirationAction==='delete'?'Confirm Delete':expirationAction==='edit'?'Edit Expiration Record':'Expiration Record Details'} onDismiss={() => setExpirationAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={expirationAction==='delete'?'A live expiration record is required before deletion can be confirmed.':expirationAction==='edit'?'A live expiration record is required before editing.':'Expiration record details will appear here when live records are available.'} /></div>
      {expirationAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setExpirationAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live expiration record">Confirm Delete</button></div>}
    </Dialog>
  </>;
}

function SuperAdminForecastingPending({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`sl-sa-forecast-pending${compact ? ' compact' : ''}`}>
    <DataState
      kind="empty"
      title={`${label} unavailable`}
      description="The supporting forecasting service is not connected yet."
    />
  </div>;
}

export function SuperAdminForecastingPage() {
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastIngredient, setForecastIngredient] = useState('All Ingredients');
  const [forecastStatus, setForecastStatus] = useState('All Statuses');
  const [forecastPeriod, setForecastPeriod] = useState('any');
  const [forecastDateFrom, setForecastDateFrom] = useState('');
  const [forecastDateTo, setForecastDateTo] = useState('');
  const [forecastRows, setForecastRows] = useState(10);
  const [forecastPage, setForecastPage] = useState(1);
  const [forecastAction, setForecastAction] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [forecastTrendDays, setForecastTrendDays] = useState('14');

  const resetForecastFilters = () => {
    setForecastSearch('');
    setForecastIngredient('All Ingredients');
    setForecastStatus('All Statuses');
    setForecastPeriod('any');
    setForecastDateFrom('');
    setForecastDateTo('');
    setForecastPage(1);
  };

  return <>
    <div className="sl-sa-usage-heading">
      <header className="sl-page-header sl-sa-usage-page-header">
        <p className="sl-eyebrow">System Oversight</p>
        <h1 className="sl-page-title">Forecasting</h1>
        <p className="sl-description sl-sa-usage-description" style={{ whiteSpace: 'nowrap', maxWidth: 'none', width: 'max-content' }}>
          View AI-generated demand forecasts, compare with actual usage, and monitor forecast accuracy across all branches.
        </p>
      </header>
    </div>

    <div className="sl-admin-view sl-sa-forecast-page sl-sa-usage-page sl-sa-ingredients-page sl-sa-usage-inventory-pattern sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Forecasting summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><BarChart3 aria-hidden="true" /></span><div><span>Forecasted Items</span><strong>—</strong><small>Awaiting forecast summary API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Target aria-hidden="true" /></span><div><span>Average Forecast Accuracy</span><strong>—</strong><small>Awaiting forecast accuracy API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span><div><span>High Demand Increase</span><strong>—</strong><small>Awaiting demand-change API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingDown aria-hidden="true" /></span><div><span>Predicted Decrease</span><strong>—</strong><small>Awaiting demand-change API</small></div></article>
      </section>

      <div className="sl-sa-forecast-layout sl-sa-ingredients-layout sl-sa-usage-ingredients-layout">
        <main className="sl-sa-forecast-main sl-sa-ingredients-main sl-sa-usage-ingredients-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records" aria-label="Forecast records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span><h2>Forecast Records</h2></header>

            <div className="sl-sa-ingredients-table-filters">
              <div className="sl-sa-ingredients-filter-card" aria-label="Forecast filters">
                <label className="sl-sa-ingredients-search"><span>Search forecasts</span><div><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search by ingredient or forecast…" value={forecastSearch} onChange={event => setForecastSearch(event.target.value)} /></div></label>
                <label><span>Ingredient</span><select value={forecastIngredient} onChange={event => { setForecastIngredient(event.target.value); setForecastPage(1); }}><option>All Ingredients</option></select></label>
                <label><span>Status</span><select value={forecastStatus} onChange={event => { setForecastStatus(event.target.value); setForecastPage(1); }}><option>All Statuses</option><option>Increase</option><option>Stable</option><option>Decrease</option></select></label>
                <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Forecast Period</span><select value={forecastPeriod} onChange={event => { setForecastPeriod(event.target.value); setForecastPage(1); }} aria-label="Forecast period"><option value="any">Any period</option><option value="week">Last week</option><option value="month">Last month</option><option value="year">Last year</option><option value="custom">Custom</option></select></label>
                {forecastPeriod === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom forecast period"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={forecastDateFrom} max={forecastDateTo || undefined} onChange={event => { setForecastDateFrom(event.target.value); setForecastPage(1); }} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={forecastDateTo} min={forecastDateFrom || undefined} onChange={event => { setForecastDateTo(event.target.value); setForecastPage(1); }} /></label></div>}
                <div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={resetForecastFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-forecast-export-menu" /></div>
              </div>
            </div>

            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell" role="region" aria-label="Forecast records" tabIndex={0}>
              <table className="sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-security-activity-reference-table">
                <thead><tr><th scope="col">Ingredient</th><th scope="col">Current Stock</th><th scope="col">Avg. Daily Usage</th><th scope="col">Forecasted Demand</th><th scope="col">Forecast Accuracy</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody><tr className="sl-sa-records-dash-row sl-sa-ingredients-preview-row"><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td><span>—</span></td><td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Forecast record actions preview"><button type="button" className="sl-icon-button" aria-label="View forecast record" title="View" onClick={() => setForecastAction('view')}><Eye size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button" aria-label="Edit forecast record" title="Edit" onClick={() => setForecastAction('edit')}><Pencil size={16} aria-hidden="true" /></button><button type="button" className="sl-icon-button sl-staff-waste-delete" aria-label="Delete forecast record" title="Delete" onClick={() => setForecastAction('delete')}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr></tbody>
              </table>
            </div>

            <div className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer">
              <label><span>Rows per page</span><select value={forecastRows} aria-label="Rows per page" onChange={event => { setForecastRows(Number(event.target.value)); setForecastPage(1); }}><option value={10}>10</option><option value={15}>15</option><option value={50}>50</option><option value={100}>100</option><option value={150}>150</option></select></label>
              <Pagination compact page={forecastPage} pageSize={forecastRows} total={0} itemLabel="forecasts" onPageChange={setForecastPage} />
            </div>
          </section>
        </main>

        <aside className="sl-sa-forecast-rail sl-sa-usage-analytics-rail" aria-label="Forecast analytics panels">
          <Card id="sa-forecast-vs-actual" title="Forecast vs. Actual Usage" action={<label className="sl-dashboard-filter sl-sa-forecast-chart-period"><select aria-label="Forecast vs actual usage period" value={forecastTrendDays} onChange={event => setForecastTrendDays(event.target.value)}><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option></select></label>}>
            <div className="sl-sa-forecast-chart-shell" aria-label="Forecast versus actual usage chart structure">
              <div className="sl-sa-forecast-chart-legend"><span><i className="sl-sa-forecast-legend-line" />Forecasted Demand</span><span><i className="sl-sa-forecast-legend-line sl-sa-forecast-legend-actual" />Avg. Daily Usage</span></div>
              <div className="sl-sa-forecast-chart-frame"><div className="sl-sa-forecast-chart-y" aria-label="Usage quantity axis"><span className="sl-sa-forecast-axis-title">Usage quantity</span></div><div className="sl-sa-forecast-chart-grid" aria-hidden="true"><i/><i/><i/><i/><i/></div><div className="sl-sa-forecast-chart-plot" aria-hidden="true"><span className="sl-sa-forecast-preview-line sl-sa-forecast-preview-forecast"/><span className="sl-sa-forecast-preview-line sl-sa-forecast-preview-actual"/></div><div className="sl-sa-forecast-chart-empty">Awaiting live forecast and usage data</div></div>
              <div className="sl-sa-forecast-chart-x"><span className="sl-sa-forecast-axis-title">Date</span></div>
            </div>
          </Card>
          <Card id="sa-forecast-increase" title="Top Ingredients by Predicted Demand Increase"><div className="sl-sa-forecast-ranking-shell" aria-label="Predicted demand increase chart structure"><div className="sl-sa-forecast-ranking-axis"><span>Ingredient</span><span>Predicted demand change</span></div><div className="sl-sa-forecast-ranking-preview" aria-hidden="true"><i/><i/><i/><i/></div><div className="sl-sa-forecast-ranking-empty">Awaiting live forecast data</div></div></Card>
          <Card id="sa-forecast-decrease" title="Top Ingredients by Predicted Demand Decrease"><div className="sl-sa-forecast-ranking-shell" aria-label="Predicted demand decrease chart structure"><div className="sl-sa-forecast-ranking-axis"><span>Ingredient</span><span>Predicted demand change</span></div><div className="sl-sa-forecast-ranking-preview" aria-hidden="true"><i/><i/><i/><i/></div><div className="sl-sa-forecast-ranking-empty">Awaiting live forecast data</div></div></Card>
          <Card id="sa-forecast-insights" title="Forecast Insights"><div className="sl-sa-forecast-insights-shell" aria-label="Forecast insights structure"><div className="sl-sa-forecast-insight-row"><span>Demand pattern</span><strong>—</strong></div><div className="sl-sa-forecast-insight-row"><span>Forecast confidence</span><strong>—</strong></div><div className="sl-sa-forecast-insight-row"><span>Recommended attention</span><strong>—</strong></div></div></Card>
        </aside>
      </div>
    </div>

    <Dialog open={forecastAction!==null} title={forecastAction==='delete'?'Confirm Delete':forecastAction==='edit'?'Edit Forecast Record':'Forecast Record Details'} onDismiss={() => setForecastAction(null)} className="sl-staff-waste-action-dialog">
      <div className="sl-staff-waste-action-pending"><DataState kind="empty" title="No live records yet" description={forecastAction==='delete'?'A live forecast record is required before deletion can be confirmed.':forecastAction==='edit'?'A live forecast record is required before editing.':'Forecast record details will appear here when live records are available.'} /></div>
      {forecastAction==='delete' && <div className="sl-dialog-actions"><button type="button" className="sl-button" onClick={() => setForecastAction(null)}>Cancel</button><button type="button" className="sl-button sl-button-danger" title="Deletion requires a live forecast record">Confirm Delete</button></div>}
    </Dialog>
  </>;
}

function ManagerForecastingPage() {
  const [range, setRange] = useState('Current period');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [branch, setBranch] = useState('Current Branch');
  const [trendPeriod, setTrendPeriod] = useState('Last 30 Days');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const Pending = ({ label, compact = false }: { label: string; compact?: boolean }) => <div className={`sl-mgr-forecast-pending${compact ? ' compact' : ''}`}><DataState kind="empty" title={`${label} unavailable`} description="Forecasting data is not connected yet." /></div>;
  return <>
    <PageHeader eyebrow="Intelligence" title="Forecasting" description="AI-assisted demand forecasting to help you plan purchases, reduce waste, and ensure ingredient availability." />
    <div className="sl-admin-view sl-mgr-forecast-page">
      <section className="sl-sa-kpis sl-admin-reference-kpis sl-mgr-forecast-kpis sl-kpi-reference-v201" aria-label="Forecasting summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><FileInput /></span><div><span>Total Ingredients Forecasted</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><CalendarDays /></span><div><span>High Demand (Next 7 Days)</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>At Risk of Overstock</span><strong>—</strong><small>Data unavailable</small></div></article>
      </section>

      <section className="sl-mgr-forecast-analytics" aria-label="Forecast analytics">
        <Card id="mgr-forecast-v-actual" title="Forecast vs. Actual Usage" action={<label className="sl-dashboard-filter"><select aria-label="Forecast trend period" value={trendPeriod} onChange={e=>setTrendPeriod(e.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option></select></label>}><Pending label="Forecast vs. actual usage" /></Card>
        <Card id="mgr-category-demand" title="Category Demand Forecast (Next 30 Days)"><Pending label="Category demand forecast" /></Card>
        <Card id="mgr-forecast-insights" title="Forecast Insights"><Pending label="Forecast insights" /></Card>
      </section>

      <section className="sl-mgr-forecast-filters" aria-label="Forecast filters">
        <label><span>Date Range</span><select value={range} onChange={event => { setRange(event.target.value); setPage(1); }}><option>Current period</option><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option><option>Custom</option></select></label>
        {range === 'Custom' && <div className="sl-v219-custom-date-range" aria-label="Custom forecast date range"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); setPage(1); }} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); setPage(1); }} /></label></div>}
        <label><span>Ingredient Category</span><select value={category} onChange={e=>setCategory(e.target.value)}><option>All Categories</option></select></label>
        <label><span>Branch</span><select value={branch} onChange={e=>setBranch(e.target.value)}><option>Current Branch</option></select></label>
        <button className="sl-button sl-button-primary" type="button">Apply Filters</button>
      </section>

      <Card id="mgr-ingredient-forecasts" title={<span className="sl-dashboard-card-heading"><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span><span>Ingredient Forecasts</span></span>} action={<div className="sl-mgr-forecast-table-actions"><span className="sl-directory-search"><Search size={16}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search ingredients..." /></span><button className="sl-button sl-download-trigger" disabled><Download size={16}/> Export Forecast</button></div>}>
        <div className="sl-mgr-forecast-tablewrap"><table className="sl-reference-records-table"><thead><tr><th>#</th><th>Ingredient</th><th>Category</th><th>Current Stock</th><th>Avg. Daily Usage</th><th>Forecasted Demand (Next 30 Days)</th><th>Recommended Action</th><th>Risk Level</th><th>Actions</th></tr></thead><tbody><tr aria-label="Forecast values unavailable">{Array.from({length:9}).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table></div>
        <div className="sl-mgr-forecast-footer sl-reference-records-footer"><label>Rows per page <select value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{[10,15,50,100,150].map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={0} itemLabel="forecasts" onPageChange={setPage} /></div>
      </Card>
    </div>
  </>;
}


function ManagerChangeRequestsPage() {
  type SelectedRequest = { id: string; type?: string; target?: string; requestedChange?: string; submittedBy?: string; submittedAt?: string; status?: string; reason?: string };
  const [search, setSearch] = useState('');
  const [requestType, setRequestType] = useState('All Types');
  const [submittedBy, setSubmittedBy] = useState('All Staff');
  const [status, setStatus] = useState('All Statuses');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest | null>(null);
  const reset = () => { setSearch(''); setRequestType('All Types'); setSubmittedBy('All Staff'); setStatus('All Statuses'); setDateRange('Last 30 Days'); setDateFrom(''); setDateTo(''); setPage(1); };
  return <>
    <PageHeader eyebrow="Operations" title="Change Requests" description="Review and decide on inventory-related requests submitted by your team." />
    <div className="sl-admin-view sl-mgr-cr-page">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Change request summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileInput/></span><div><span>Total Requests</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Clock3/></span><div><span>Pending Review</span><strong>—</strong><small>Requires your action</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><CheckCircle2/></span><div><span>Approved (This Month)</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle/></span><div><span>Rejected (This Month)</span><strong>—</strong><small>Data unavailable</small></div></article>
      </section>
      <div className={`sl-mgr-cr-layout${selectedRequest ? ' has-selected-request' : ' no-selected-request'}`}>
        <section className="sl-mgr-cr-listcard sl-sa-account-pattern-records sl-manager-request-records">
          <header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><FileText aria-hidden="true" /></span><h2>Change Request Records</h2></header>
          <div className="sl-sa-ingredients-table-filters">
          <div className="sl-sa-ingredients-filter-card sl-mgr-cr-filters">
            <label className="search sl-sa-ingredients-search"><span className="sl-sr-only">Search requests</span><div><Search size={17}/><input placeholder="Search requests..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></label>
            <label><span>Request Type</span><select value={requestType} onChange={event => { setRequestType(event.target.value); setPage(1); }}><option>All Types</option><option>Stock Adjustment</option><option>Usage Correction</option><option>Waste Correction</option></select></label>
            <label><span>Submitted By</span><select value={submittedBy} onChange={event => { setSubmittedBy(event.target.value); setPage(1); }}><option>All Staff</option></select></label>
            <label><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>{['All Statuses','Approved','Pending','Rejected'].map(option => <option key={option}>{option}</option>)}</select></label>
            <label><span>Date Range</span><div className="date"><CalendarDays size={16}/><select value={dateRange} onChange={event => { setDateRange(event.target.value); setPage(1); }}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>Custom</option></select></div></label>
            {dateRange === 'Custom' && <div className="sl-v219-custom-date-range" aria-label="Custom change request date range"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); setPage(1); }} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); setPage(1); }} /></label></div>}
            <button className="sl-button" type="button" onClick={reset}>Reset</button>
          </div>
          </div>
          <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell sl-mgr-cr-tablewrap">
            <table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-mgr-cr-table"><thead><tr><th>#</th><th>Request ID</th><th>Type</th><th>Ingredient / Batch</th><th>Requested Change</th><th>Submitted By</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr className="sl-sa-records-dash-row" aria-label="Change request values unavailable">{Array.from({length:9}).map((_, index) => <td key={index}>—</td>)}</tr></tbody></table>
          </div>
          <footer className="sl-records-footer sl-staff-usage-footer sl-mgr-cr-footer"><label>Rows per page <select value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{[10,15,50,100,150].map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={0} itemLabel="request records" onPageChange={setPage} /></footer>
        </section>
        {selectedRequest && <aside className="sl-mgr-cr-details">
          <header><strong>Request Details</strong><button type="button" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>×</button></header>
          <dl className="sl-mgr-cr-detail-fields" aria-label="Selected change request details">
            <div><dt>Request ID</dt><dd>{selectedRequest.id}</dd></div>
            <div><dt>Request Type</dt><dd>{selectedRequest.type ?? '—'}</dd></div>
            <div><dt>Ingredient / Batch</dt><dd>{selectedRequest.target ?? '—'}</dd></div>
            <div><dt>Requested Change</dt><dd>{selectedRequest.requestedChange ?? '—'}</dd></div>
            <div><dt>Submitted By</dt><dd>{selectedRequest.submittedBy ?? '—'}</dd></div>
            <div><dt>Date Submitted</dt><dd>{selectedRequest.submittedAt ?? '—'}</dd></div>
            <div><dt>Status</dt><dd>{selectedRequest.status ?? '—'}</dd></div>
            <div className="sl-mgr-cr-detail-reason"><dt>Reason</dt><dd>{selectedRequest.reason ?? '—'}</dd></div>
          </dl>
          <footer><button className="reject" disabled>Reject</button><button className="approve" disabled>Approve</button></footer>
        </aside>}
      </div>
    </div>
  </>;
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { user } = useApplicationWorkspace();
  const [preview, setPreview] = useState<PreviewId | null>(null);
  const [accountTotals, setAccountTotals] = useState<DashboardSummary | null>(null);
  const [accountTotalsError, setAccountTotalsError] = useState(false);
  const [adminInventorySearch, setAdminInventorySearch] = useState('');
  const [adminInventoryCategory, setAdminInventoryCategory] = useState('All Categories');
  const [adminInventoryStatus, setAdminInventoryStatus] = useState('All Statuses');
  const [adminInventoryRows, setAdminInventoryRows] = useState(10);
  const [adminInventoryPage, setAdminInventoryPage] = useState(1);
  const [adminInventoryData, setAdminInventoryData] = useState<{ items: InventoryBatch[]; total: number } | null>(null);
  const [adminInventorySummary, setAdminInventorySummary] = useState<InventoryBatchSummary | null>(null);
  const [adminInventoryLoading, setAdminInventoryLoading] = useState(false);
  const [adminInventoryError, setAdminInventoryError] = useState(false);
  const [adminInventoryDetail, setAdminInventoryDetail] = useState<InventoryBatch | null>(null);
  const [adminInventoryDetailError, setAdminInventoryDetailError] = useState('');
  useEffect(() => {
    if (moduleId !== 'UserManagement') return;
    const abort = new AbortController(); setAccountTotalsError(false);
    accountSummary(abort.signal).then(setAccountTotals).catch(() => { if (!abort.signal.aborted) setAccountTotalsError(true); });
    return () => abort.abort();
  }, [moduleId]);
  useEffect(() => {
    if (moduleId !== 'InventoryBatches' || user.role !== 'Admin') return;
    const abort = new AbortController();
    setAdminInventoryLoading(true); setAdminInventoryError(false);
    const query = {
      page: adminInventoryPage, pageSize: adminInventoryRows,
      ...(adminInventorySearch.trim() ? { search: adminInventorySearch.trim() } : {}),
      ...(adminInventoryCategory !== 'All Categories' ? { category: adminInventoryCategory } : {}),
      ...(adminInventoryStatus !== 'All Statuses' ? { status: adminInventoryStatus as InventoryBatchDisplayStatus } : {}),
    };
    Promise.all([listInventoryBatches(query, abort.signal), getInventoryBatchSummary(abort.signal)])
      .then(([data, summary]) => { setAdminInventoryData(data); setAdminInventorySummary(summary); })
      .catch(() => { if (!abort.signal.aborted) setAdminInventoryError(true); })
      .finally(() => { if (!abort.signal.aborted) setAdminInventoryLoading(false); });
    return () => abort.abort();
  }, [moduleId, user.role, adminInventoryPage, adminInventoryRows, adminInventorySearch, adminInventoryCategory, adminInventoryStatus]);
  const staff = user.role === 'Inventory Staff';
  if (moduleId === 'UserManagement') {
    const adminUsers = user.role === 'Admin';
    const liveValue = (value: number | undefined) => accountTotals ? (value ?? 0).toLocaleString() : (accountTotalsError ? 'Unavailable' : 'Loading…');
    return <>
      <PageHeader eyebrow={adminUsers ? 'User management' : 'Administration'} title={adminUsers ? 'Users' : 'User Management'} description={adminUsers ? 'Manage establishment users, their roles, and access within ShelfLife AI.' : 'Control access, manage permissions, and monitor system participants.'} />
      <div className="sl-admin-view sl-user-management-view">
        {!adminUsers && <SummaryCards items={[
          { label: 'Total users', value: liveValue(accountTotals?.totalUsers), detail: 'Directory total from live account data', tone: 'brand', trend: 'line' },
          { label: 'Active users', value: liveValue(accountTotals?.activeUsers), detail: 'Active account total', tone: 'success', trend: 'accuracy' },
          { label: 'Pending invites', value: '—', detail: 'Invitation service not connected', tone: 'attention', trend: 'segments' },
          { label: 'Deactivated', value: liveValue(accountTotals?.inactiveUsers), detail: 'Inactive account total', tone: 'critical', trend: 'bars' },
        ]} />}
        <AccountsTable />
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

  if (moduleId === 'InventoryBatches' && user.role === 'Admin') {
    const kpi = (value: number | undefined) => adminInventoryLoading && !adminInventorySummary ? 'Loading…' : adminInventoryError && !adminInventorySummary ? 'Unavailable' : (value ?? 0).toLocaleString();
    const statusTone = (status: InventoryBatchDisplayStatus) => status === 'Expired' ? 'critical' : status === 'Near Expiry' || status === 'Low Stock' ? 'attention' : 'success';
    const date = (value: string) => formatDate(value);
    const openBatch = async (id: string) => {
      setAdminInventoryDetailError('');
      try { setAdminInventoryDetail(await getInventoryBatch(id)); }
      catch { setAdminInventoryDetailError('Unable to load this inventory batch.'); }
    };
    return <><div className="sl-admin-inventory-page">
    <PageHeader eyebrow="Core data" title="Inventory Batches" description="View and monitor current stock levels, expiration status, and inventory distribution for your establishment." />
    <div className="sl-admin-view">
      <div className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Inventory summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Boxes /></span><div><span>Total Ingredients</span><strong>{kpi(adminInventorySummary?.totalIngredients)}</strong><small>Distinct ingredients with inventory batches</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle /></span><div><span>Low Stock Items</span><strong>{kpi(adminInventorySummary?.lowStockItems)}</strong><small>Ingredients at or below minimum stock</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 /></span><div><span>Near Expiry (≤ 7 days)</span><strong>{kpi(adminInventorySummary?.nearExpiry)}</strong><small>Non-expired batches within seven days</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><CalendarDays /></span><div><span>Expired Items</span><strong>{kpi(adminInventorySummary?.expiredItems)}</strong><small>Batches past the server date</small></div></article>
      </div>
      <section className="sl-application-records sl-admin-inventory-records" aria-labelledby="admin-inventory-records-title">
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileText aria-hidden="true" /></span><h2 id="admin-inventory-records-title">Inventory Batches Records</h2></header>
        <div className="sl-application-records-filters"><div className="sl-application-records-toolbar" data-layout="inventory-admin">
          <label className="sl-application-records-search"><span>Search ingredients</span><div><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search by ingredient or Batch ID..." aria-label="Search ingredients or Batch ID" value={adminInventorySearch} onChange={event => { setAdminInventorySearch(event.target.value); setAdminInventoryPage(1); }} /></div></label>
          <label><span>Category</span><select value={adminInventoryCategory} disabled={adminInventoryLoading || adminInventoryError} onChange={event => { setAdminInventoryCategory(event.target.value); setAdminInventoryPage(1); }}><option>All Categories</option>{adminInventorySummary?.categories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label><span>Status</span><select value={adminInventoryStatus} onChange={event => { setAdminInventoryStatus(event.target.value); setAdminInventoryPage(1); }}><option>All Statuses</option><option>In Stock</option><option>Low Stock</option><option>Near Expiry</option><option>Expired</option></select></label>
          <div className="sl-application-records-filter-actions"><button type="button" className="sl-button" onClick={() => { setAdminInventorySearch(''); setAdminInventoryCategory('All Categories'); setAdminInventoryStatus('All Statuses'); setAdminInventoryPage(1); }}>Reset</button></div>
        </div></div>
        <div className="sl-application-records-table-shell">
          <table className="sl-application-records-table" data-layout="inventory-admin" aria-label="Inventory batches"><thead><tr>{['#','Ingredient','Batch ID','Category','Current Stock','Unit','Expiration Date','Status','Actions'].map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>
            {adminInventoryLoading && !adminInventoryData ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="loading" title="Loading inventory batches" description="Retrieving current inventory records." /></td></tr>
              : adminInventoryError ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="error" title="Inventory batches unavailable" description="The inventory batch service could not be reached. Try again later." /></td></tr>
              : !adminInventoryData?.items.length ? <tr><td colSpan={9} className="sl-empty-cell"><DataState kind="empty" title={adminInventorySummary?.totalIngredients ? 'No matching records' : 'No live records yet'} description={adminInventorySummary?.totalIngredients ? 'No inventory batches match the current filters.' : 'Inventory batches will appear here once stock is received.'} /></td></tr>
              : adminInventoryData.items.map((batch, index) => <tr key={batch.id}><td>{(adminInventoryPage - 1) * adminInventoryRows + index + 1}</td><td className="sl-emphasized-value">{batch.ingredient.name}</td><td>{batch.batchID}</td><td>{batch.ingredient.category}</td><td>{batch.quantity.toLocaleString()}</td><td>{batch.unit}</td><td><time dateTime={batch.expirationDate}>{date(batch.expirationDate)}</time></td><td><Status tone={statusTone(batch.displayStatus)}>{batch.displayStatus}</Status></td><td><button type="button" className="sl-account-action sl-account-action-view" aria-label={`View batch ${batch.batchID}`} title="View Batch" onClick={() => void openBatch(batch.id)}><Eye size={16} aria-hidden="true" /></button></td></tr>)}
          </tbody></table>
        </div>
        <footer className="sl-application-records-footer"><label><span>Rows per page</span><select value={adminInventoryRows} onChange={event => { setAdminInventoryRows(Number(event.target.value)); setAdminInventoryPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={adminInventoryPage} pageSize={adminInventoryRows} total={adminInventoryData?.total ?? 0} itemLabel="inventory records" onPageChange={setAdminInventoryPage} /></footer>
      </section>
    </div>
  </div>
    <Dialog open={Boolean(adminInventoryDetail || adminInventoryDetailError)} title="Inventory Batch Details" onDismiss={() => { setAdminInventoryDetail(null); setAdminInventoryDetailError(''); }} actions={<button type="button" className="sl-button" onClick={() => { setAdminInventoryDetail(null); setAdminInventoryDetailError(''); }}>Close</button>}>
      {adminInventoryDetailError ? <DataState kind="error" title="Batch details unavailable" description={adminInventoryDetailError} /> : adminInventoryDetail && <dl className="sl-guidance-list">
        <div><dt>Ingredient</dt><dd>{adminInventoryDetail.ingredient.name}</dd></div><div><dt>Batch ID</dt><dd>{adminInventoryDetail.batchID}</dd></div>
        <div><dt>Category</dt><dd>{adminInventoryDetail.ingredient.category}</dd></div><div><dt>Current Stock</dt><dd>{adminInventoryDetail.quantity.toLocaleString()} {adminInventoryDetail.unit}</dd></div>
        <div><dt>Date Received</dt><dd>{date(adminInventoryDetail.dateReceived)}</dd></div><div><dt>Expiration Date</dt><dd>{date(adminInventoryDetail.expirationDate)}</dd></div>
        <div><dt>Status</dt><dd><Status tone={statusTone(adminInventoryDetail.displayStatus)}>{adminInventoryDetail.displayStatus}</Status></dd></div><div><dt>Unit Cost</dt><dd>{adminInventoryDetail.unitCost === undefined ? '—' : `₱${adminInventoryDetail.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</dd></div>
      </dl>}
    </Dialog>
  </>;
  }
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
  const columns = staff && moduleId === 'ExpirationMonitoring'
    ? content.columns.map(column => column === 'Batch Code' ? 'Batch ID' : column)
    : content.columns;
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
        <PlaceholderTable label={content.title} columns={columns} description={staff && ['Usage', 'Waste', 'ChangeRequests'].includes(moduleId) ? 'Your records' : content.title} />
      </Card><aside><Card id={`guide-${moduleId}`} title={moduleId === 'Forecasting' ? 'Decision support' : 'Workflow guide'}><dl className="sl-guidance-list">{content.guide.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}</dl></Card></aside></div>
      {moduleId === 'ChangeRequests' && <Card id="request-history" title="Decision history"><PlaceholderTable label="Decision history" columns={['Request', 'Type', 'Target', 'Decision', 'Outcome']} description="Approved and rejected requests" rows={3} /></Card>}
    </div>
    <Dialog open={!!preview} title={previewTitle} onDismiss={() => setPreview(null)} actions={<button className="sl-button" onClick={() => setPreview(null)}>Close preview</button>}>{preview && <FormPreview id={preview} />}</Dialog>
  </>;
}
export function WorkflowLink({ to, title, description }: { to: string; title: string; description: string }) {
  return <Link href={to as Href} className="sl-workflow-link"><span><strong>{title}</strong><span className="sl-supporting">{description}</span></span><ArrowRight size={18} aria-hidden="true" /></Link>;
}
