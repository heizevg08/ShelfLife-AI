import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock3, FileInput, Plus, Search, XCircle } from 'lucide-react';
import { APPLICATION_RECORD_PAGE_SIZES } from '../../components/application/ApplicationPatterns';
import { InventoryStaffModal, InventoryStaffModalForm } from '../../components/application/InventoryStaffModal';
import { ChangeRequestDetailsDialog } from '../../components/application/ChangeRequestDetailsDialog';
import { DataState, PageHeader, Pagination, Status } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage } from '../../components/application/ModulePage';
import { ApiError } from '../../services/apiClient';
import { CHANGE_REQUEST_TYPES, CHANGE_REQUEST_UNITS, createChangeRequest, getChangeRequest, getChangeRequestSummary, listChangeRequests, type ChangeRequest, type ChangeRequestInput, type ChangeRequestType } from '../../services/change-requests';
import { listStockInIngredients, type StockInIngredient } from '../../services/ingredients';
import { listInventoryBatches, type InventoryBatch } from '../../services/inventory-batches';
import { formatDate, formatDateTime } from '../../utils/date-time';

const DATE_RANGES = ['All dates', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom range'] as const;
const REQUEST_COLUMNS = ['Request ID', 'Date Submitted', 'Ingredient', 'Request Type', 'Details / Reason', 'Status', 'Reviewed By'] as const;
const TYPE_LABELS: Record<ChangeRequestType, string> = { BATCH_CORRECTION: 'Batch Correction', QUANTITY_ADJUSTMENT: 'Quantity Adjustment', UNIT_CORRECTION: 'Unit Correction', ADD_MISSING_BATCH: 'Add Missing Batch', OTHER: 'Other' };
const BATCH_CORRECTION_TARGETS = [{ value: 'dateReceived', label: 'Date Received' }, { value: 'expirationDate', label: 'Expiration Date' }, { value: 'unitCost', label: 'Unit Cost' }] as const;
type Field = 'requestType' | 'ingredientId' | 'batchId' | 'targetField' | 'requestedValue' | 'requestedQuantity' | 'requestedUnit' | 'dateReceived' | 'quantityReceived' | 'expirationDate' | 'unitCost' | 'requestDescription' | 'reason';
type Draft = {
  requestType: ChangeRequestType | ''; ingredientId: string; batchId: string; targetField: string; requestedValue: string;
  requestedQuantity: string; requestedUnit: string; dateReceived: string; quantityReceived: string; expirationDate: string; unitCost: string; requestDescription: string; reason: string;
};
const emptyDraft = (): Draft => ({ requestType: '', ingredientId: '', batchId: '', targetField: '', requestedValue: '', requestedQuantity: '', requestedUnit: '', dateReceived: '', quantityReceived: '', expirationDate: '', unitCost: '', requestDescription: '', reason: '' });
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const datesFor = (range: (typeof DATE_RANGES)[number], from: string, to: string) => { const now = new Date(); if (range === 'Today') { const today = localDate(now); return { from: today, to: today }; } if (range === 'Last 7 Days' || range === 'Last 30 Days') { const start = new Date(now); start.setDate(now.getDate() - (range === 'Last 7 Days' ? 6 : 29)); return { from: localDate(start), to: localDate(now) }; } return range === 'Custom range' ? { from, to } : {}; };
const needsBatch = (type: Draft['requestType']) => type === 'BATCH_CORRECTION' || type === 'QUANTITY_ADJUSTMENT';
const statusTone = (status: ChangeRequest['status']) => status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'critical' : 'attention';

function InventoryStaffChangeRequests() {
  const addButton = useRef<HTMLButtonElement>(null); const formRef = useRef<HTMLFormElement>(null); const interactions = useRef<Partial<Record<Field, boolean>>>({});
  const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState(''); const [type, setType] = useState(''); const [status, setStatus] = useState(''); const [range, setRange] = useState<(typeof DATE_RANGES)[number]>('All dates'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1); const [rows, setRows] = useState(10);
  const [records, setRecords] = useState<{ items: ChangeRequest[]; total: number }>({ items: [], total: 0 }); const [summary, setSummary] = useState<{ totalRequests: number; approved: number; pending: number; rejected: number } | null>(null); const [recordsLoading, setRecordsLoading] = useState(true); const [summaryLoading, setSummaryLoading] = useState(true); const [loadError, setLoadError] = useState(''); const [summaryError, setSummaryError] = useState(false);
  const [open, setOpen] = useState(false); const [detail, setDetail] = useState<ChangeRequest | null>(null); const [draft, setDraft] = useState<Draft>(emptyDraft); const [ingredients, setIngredients] = useState<StockInIngredient[]>([]); const [batches, setBatches] = useState<InventoryBatch[]>([]); const [errors, setErrors] = useState<Partial<Record<Field, string>>>({}); const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({}); const [attempted, setAttempted] = useState(false); const [saving, setSaving] = useState(false);
  const period = datesFor(range, from, to);
  const load = async (signal?: AbortSignal) => { setRecordsLoading(true); setLoadError(''); try { setRecords(await listChangeRequests({ page, pageSize: rows, search: debouncedSearch.trim() || undefined, type: type as ChangeRequestType || undefined, status: status as ChangeRequest['status'] || undefined, ...period }, signal)); } catch (error) { if ((error as Error).name !== 'AbortError') setLoadError(error instanceof ApiError ? error.message : 'Unable to load change requests.'); } finally { if (!signal?.aborted) setRecordsLoading(false); } };
  useEffect(() => { const timeout = window.setTimeout(() => setDebouncedSearch(search), 250); return () => window.clearTimeout(timeout); }, [search]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [page, rows, debouncedSearch, type, status, range, from, to]);
  useEffect(() => { const controller = new AbortController(); setSummaryLoading(true); setSummaryError(false); void getChangeRequestSummary(controller.signal).then(setSummary).catch(error => { if ((error as Error).name !== 'AbortError') setSummaryError(true); }).finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); }); return () => controller.abort(); }, []);
  useEffect(() => { if (!open) return; const controller = new AbortController(); void listStockInIngredients(controller.signal).then(result => setIngredients(result.ingredients)).catch(() => setIngredients([])); return () => controller.abort(); }, [open]);
  useEffect(() => { if (!draft.ingredientId || !needsBatch(draft.requestType)) { setBatches([]); return; } const controller = new AbortController(); void listInventoryBatches({ page: 1, pageSize: 150, ingredientId: draft.ingredientId }, controller.signal).then(result => setBatches(result.items)).catch(() => setBatches([])); return () => controller.abort(); }, [draft.ingredientId, draft.requestType]);
  const resetForm = () => { interactions.current = {}; setDraft(emptyDraft()); setBatches([]); setErrors({}); setTouched({}); setAttempted(false); };
  const show = (field: Field) => Boolean(errors[field] && (attempted || touched[field]));
  const selectedIngredient = ingredients.find(item => item.id === draft.ingredientId);
  const selectedBatch = batches.find(item => item.id === draft.batchId);
  const validate = (value = draft) => {
    const next: Partial<Record<Field, string>> = {};
    if (!value.requestType) { next.requestType = 'Select a request type.'; return next; }
    const requiresIngredient = value.requestType !== 'OTHER' || Boolean(value.ingredientId);
    if (requiresIngredient && value.requestType !== 'OTHER' && !value.ingredientId) next.ingredientId = 'Select an ingredient.';
    if (needsBatch(value.requestType) && !value.batchId) next.batchId = 'Select a batch ID.';
    if (value.requestType === 'BATCH_CORRECTION') {
      if (!value.targetField) next.targetField = 'Select a detail to correct.';
      if (!value.requestedValue.trim()) next.requestedValue = value.targetField === 'unitCost' ? 'Enter the requested unit cost.' : 'Select the requested date.';
      if (value.targetField === 'unitCost' && value.requestedValue.trim() && (!Number.isFinite(Number(value.requestedValue)) || Number(value.requestedValue) < 0)) next.requestedValue = 'Enter a valid unit cost.';
    }
    if (value.requestType === 'QUANTITY_ADJUSTMENT') {
      if (!value.requestedQuantity.trim()) next.requestedQuantity = 'Enter the requested quantity.';
      else if (!Number.isFinite(Number(value.requestedQuantity)) || Number(value.requestedQuantity) <= 0) next.requestedQuantity = 'Enter a valid requested quantity.';
    }
    if (value.requestType === 'UNIT_CORRECTION' && !value.requestedUnit) next.requestedUnit = 'Select the requested unit.';
    if (value.requestType === 'ADD_MISSING_BATCH') {
      if (!value.dateReceived) next.dateReceived = 'Select the date received.';
      if (!value.quantityReceived.trim()) next.quantityReceived = 'Enter the quantity received.';
      else if (!Number.isFinite(Number(value.quantityReceived)) || Number(value.quantityReceived) <= 0) next.quantityReceived = 'Enter a valid quantity received.';
      if (!value.expirationDate) next.expirationDate = 'Select the expiration date.';
      else if (value.dateReceived && value.expirationDate <= value.dateReceived) next.expirationDate = 'Expiration date must be after the date received.';
      if (value.unitCost.trim() && (!Number.isFinite(Number(value.unitCost)) || Number(value.unitCost) < 0)) next.unitCost = 'Enter a valid unit cost.';
    }
    if (value.requestType === 'OTHER' && !value.requestDescription.trim()) next.requestDescription = 'Enter the request description.';
    if (!value.reason.trim()) next.reason = 'Enter the reason for this request.';
    return next;
  };
  const clearValidation = () => { interactions.current = {}; setErrors({}); setTouched({}); setAttempted(false); };
  const changeRequestType = (value: Draft['requestType']) => { interactions.current = {}; setErrors({}); setTouched({}); setAttempted(false); setBatches([]); setDraft({ ...emptyDraft(), requestType: value }); };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    if (key === 'requestType') { changeRequestType(value as Draft['requestType']); return; }
    if (key === 'ingredientId') {
      interactions.current.batchId = false;
      setTouched(current => ({ ...current, batchId: false }));
      setErrors(current => { const { batchId, ...rest } = current; return rest; });
    }
    const next = { ...draft, [key]: value } as Draft;
    if (key === 'requestType') Object.assign(next, emptyDraft(), { requestType: value });
    if (key === 'ingredientId') next.batchId = '';
    setDraft(next);
    const shouldRevalidate = attempted || touched[key] || (typeof value === 'string' && value.trim().length > 0);
    if (shouldRevalidate) {
      const fieldError = validate(next)[key as Field];
      setErrors(current => ({ ...current, [key]: fieldError }));
    }
  };
  const mark = (field: Field) => () => { interactions.current[field] = true; };
  const blur = (field: Field) => () => { if (!interactions.current[field]) return; setTouched(current => ({ ...current, [field]: true })); setErrors(validate()); };
  const batchCorrectionCurrentValue = () => {
    if (!selectedBatch || !draft.targetField) return '\u2014';
    const value = selectedBatch[draft.targetField as keyof InventoryBatch];
    if (value === undefined || value === null) return '\u2014';
    if (draft.targetField === 'unitCost') return String(value);
    if (draft.targetField === 'dateReceived' || draft.targetField === 'expirationDate') return localDate(new Date(String(value)));
    return String(value);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setAttempted(true); setErrors(next); setTouched(Object.keys(next).reduce<Partial<Record<Field, boolean>>>((result, field) => ({ ...result, [field]: true }), {}));
    if (Object.keys(next).length) return;
    const base = { requestType: draft.requestType as ChangeRequestType, reason: draft.reason.trim(), ...(draft.ingredientId ? { ingredientId: draft.ingredientId } : {}) };
    const input: ChangeRequestInput = draft.requestType === 'BATCH_CORRECTION'
      ? { ...base, batchId: draft.batchId, targetField: draft.targetField, requestedValue: draft.requestedValue.trim() }
      : draft.requestType === 'QUANTITY_ADJUSTMENT'
        ? { ...base, batchId: draft.batchId, requestedQuantity: Number(draft.requestedQuantity) }
        : draft.requestType === 'UNIT_CORRECTION'
          ? { ...base, requestedUnit: draft.requestedUnit }
          : draft.requestType === 'ADD_MISSING_BATCH'
            ? { ...base, proposedBatch: { dateReceived: draft.dateReceived, quantityReceived: Number(draft.quantityReceived), expirationDate: draft.expirationDate, ...(draft.unitCost.trim() ? { unitCost: Number(draft.unitCost) } : {}) } }
            : { ...base, requestDescription: draft.requestDescription.trim() };
    setSaving(true);
    try {
      await createChangeRequest(input); setOpen(false); resetForm();
      await Promise.all([load(), getChangeRequestSummary().then(value => { setSummary(value); setSummaryError(false); })]);
    }
    catch (error) { if (error instanceof ApiError) setErrors(error.details.reduce<Partial<Record<Field, string>>>((result, item) => ({ ...result, [item.field as Field]: item.message }), {})); }
    finally { setSaving(false); }
  };
  const filtered = Boolean(search || type || status || range !== 'All dates'); const reset = () => { setSearch(''); setType(''); setStatus(''); setRange('All dates'); setFrom(''); setTo(''); setPage(1); };
  const openDetail = async (id: string) => { try { setDetail(await getChangeRequest(id)); } catch { setDetail(null); } };
  const kpis = [[FileInput, 'brand', 'Total Requests', summary?.totalRequests, summaryError ? 'Request summary unavailable' : 'Requests you submitted'], [CheckCircle2, 'info', 'Approved', summary?.approved, summaryError ? 'Request summary unavailable' : 'Approved requests'], [Clock3, 'attention', 'Pending Review', summary?.pending, summaryError ? 'Request summary unavailable' : 'Awaiting manager review'], [XCircle, 'critical', 'Rejected', summary?.rejected, summaryError ? 'Request summary unavailable' : 'Rejected requests']] as const;
  return <><PageHeader eyebrow="Follow-up" title="My Requests" description="Track the status of your inventory change requests." /><div className="sl-admin-view sl-staff-usage-v150 sl-staff-requests-v162 sl-staff-my-requests"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="My request summary">{kpis.map(([Icon, tone, label, value, helper]) => <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone={tone} key={label}><span className="sl-sa-kpi-icon"><Icon /></span><div><span>{label}</span><strong>{summaryLoading || value === undefined ? '—' : value}</strong><small>{helper}</small></div></article>)}</section>
    <section className="sl-application-records sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records sl-staff-my-requests-records" aria-labelledby="my-request-records-title"><header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><FileInput aria-hidden="true" /></span><h2 id="my-request-records-title">Change Request Records</h2></header><div className="sl-sa-ingredients-table-filters"><div className="sl-sa-ingredients-filter-card sl-staff-requests-toolbar"><label className="sl-sa-ingredients-search"><span>Search records</span><div><Search size={17} aria-hidden="true" /><input type="search" value={search} placeholder="Search by request ID, ingredient, or batch ID..." onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></label><label><span>Type</span><select value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">All Types</option>{CHANGE_REQUEST_TYPES.map(option => <option key={option} value={option}>{TYPE_LABELS[option]}</option>)}</select></label><label><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All Statuses</option><option value="PENDING">Pending Review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label><label><span>Date range</span><select value={range} onChange={event => { setRange(event.target.value as typeof range); setPage(1); }}>{DATE_RANGES.map(option => <option key={option}>{option}</option>)}</select></label>{range === 'Custom range' && <div className="sl-v219-custom-date-range"><label><span>From</span><input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label></div>}<div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={reset}>Reset</button><button ref={addButton} type="button" className="sl-button sl-button-primary sl-staff-usage-add" onClick={() => { resetForm(); setOpen(true); }}><Plus size={16} aria-hidden="true" />New Request</button></div></div></div>
      <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell"><table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-my-requests-table"><thead><tr>{REQUEST_COLUMNS.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{recordsLoading ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="loading" title="Loading change requests" description="Retrieving your submitted requests." /></td></tr> : loadError ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="error" title="Unable to load requests" description={loadError} /></td></tr> : records.items.length === 0 ? <tr><td colSpan={7} className="sl-empty-cell"><DataState kind="empty" title={filtered ? 'No matching records' : 'No requests yet'} description={filtered ? 'Try adjusting the filters.' : 'Submit a request when an inventory record needs review.'} /></td></tr> : records.items.map(record => <tr key={record.id} className="sl-staff-my-request-row sl-detail-enabled-row" tabIndex={0} role="button" onClick={() => void openDetail(record.id)} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openDetail(record.id); } }}><td><button className="sl-record-identifier-link" type="button" onClick={event => { event.stopPropagation(); void openDetail(record.id); }}>{record.requestID}</button></td><td>{formatDateTime(record.createdAt)}</td><td>{record.ingredient ? <span className="sl-emphasized-value">{record.ingredient.name}</span> : '—'}</td><td>{TYPE_LABELS[record.requestType]}</td><td title={record.reason}>{record.reason}</td><td><Status tone={statusTone(record.status)}>{record.status === 'PENDING' ? 'Pending Review' : record.status[0] + record.status.slice(1).toLowerCase()}</Status></td><td>{record.reviewedBy?.name ?? '—'}</td></tr>)}</tbody></table></div><footer className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer"><label><span>Rows per page</span><select value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(option => <option key={option}>{option}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={records.total} itemLabel="request records" onPageChange={setPage} /></footer></section></div>
  <InventoryStaffModal open={open} title="New Change Request" subtitle="Describe the inventory record change that needs review." Icon={FileInput} onDismiss={() => { if (!saving) { setOpen(false); resetForm(); } }} returnFocus={addButton} showClose={false} className={`sl-staff-my-request-dialog${draft.requestType ? '' : ' sl-staff-my-request-dialog--initial'}`}><InventoryStaffModalForm formRef={formRef} onSubmit={submit} secondaryLabel="Cancel" onSecondary={() => { setOpen(false); resetForm(); }} primaryLabel="Submit Request" busy={saving} className="sl-staff-my-request-form"><div className="sl-staff-my-request-form-grid">
    <label className={!draft.requestType ? 'sl-staff-my-request-full' : undefined}><span>Request Type</span><select value={draft.requestType} aria-invalid={show('requestType')} onPointerDown={mark('requestType')} onKeyDown={mark('requestType')} onBlur={blur('requestType')} onChange={event => changeRequestType(event.target.value as Draft['requestType'])}><option value="">Select request type</option>{CHANGE_REQUEST_TYPES.map(option => <option key={option} value={option}>{TYPE_LABELS[option]}</option>)}</select>{show('requestType') && <span className="sl-field-error" role="alert">{errors.requestType}</span>}</label>
    {draft.requestType && draft.requestType !== 'OTHER' && <label><span>Ingredient</span><select value={draft.ingredientId} aria-invalid={show('ingredientId')} onPointerDown={mark('ingredientId')} onKeyDown={mark('ingredientId')} onBlur={blur('ingredientId')} onChange={event => update('ingredientId', event.target.value)}><option value="">Select ingredient</option>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{show('ingredientId') && <span className="sl-field-error" role="alert">{errors.ingredientId}</span>}</label>}
    {draft.requestType === 'OTHER' && <label><span>Inventory Target (Optional)</span><select value={draft.ingredientId} onChange={event => update('ingredientId', event.target.value)}><option value="">No inventory target</option>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {needsBatch(draft.requestType) && <label><span>Batch ID</span><select value={draft.batchId} disabled={!draft.ingredientId} aria-invalid={show('batchId')} onPointerDown={mark('batchId')} onKeyDown={mark('batchId')} onBlur={blur('batchId')} onChange={event => update('batchId', event.target.value)}><option value="">Select batch ID</option>{batches.map(item => <option key={item.id} value={item.id}>{item.batchID}</option>)}</select>{show('batchId') && <span className="sl-field-error" role="alert">{errors.batchId}</span>}</label>}
    {draft.requestType === 'BATCH_CORRECTION' && <><label><span>Detail to Correct</span><select value={draft.targetField} aria-invalid={show('targetField')} onPointerDown={mark('targetField')} onKeyDown={mark('targetField')} onBlur={blur('targetField')} onChange={event => update('targetField', event.target.value)}><option value="">Select detail</option>{BATCH_CORRECTION_TARGETS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{show('targetField') && <span className="sl-field-error" role="alert">{errors.targetField}</span>}</label><label><span>Current Value</span><output className="sl-staff-my-request-derived">{batchCorrectionCurrentValue()}</output></label><label><span>Requested Value</span>{draft.targetField === 'unitCost' ? <input type="number" min="0" step="0.01" value={draft.requestedValue} aria-invalid={show('requestedValue')} onPointerDown={mark('requestedValue')} onKeyDown={mark('requestedValue')} onBlur={blur('requestedValue')} onChange={event => update('requestedValue', event.target.value)} /> : <input type="date" value={draft.requestedValue} aria-invalid={show('requestedValue')} onPointerDown={mark('requestedValue')} onKeyDown={mark('requestedValue')} onBlur={blur('requestedValue')} onChange={event => update('requestedValue', event.target.value)} disabled={!draft.targetField} />}{show('requestedValue') && <span className="sl-field-error" role="alert">{errors.requestedValue}</span>}</label></>}
    {draft.requestType === 'QUANTITY_ADJUSTMENT' && <><label><span>Current Quantity</span><output className="sl-staff-my-request-derived">{selectedBatch ? selectedBatch.quantity : '—'}</output></label><label><span>Requested Quantity</span><input type="number" min="0" step="any" value={draft.requestedQuantity} aria-invalid={show('requestedQuantity')} onPointerDown={mark('requestedQuantity')} onKeyDown={mark('requestedQuantity')} onBlur={blur('requestedQuantity')} onChange={event => update('requestedQuantity', event.target.value)} />{show('requestedQuantity') && <span className="sl-field-error" role="alert">{errors.requestedQuantity}</span>}</label><label><span>Unit</span><output className="sl-staff-my-request-derived">{selectedBatch?.unit ?? '—'}</output></label></>}
    {draft.requestType === 'UNIT_CORRECTION' && <><label><span>Current Unit</span><output className="sl-staff-my-request-derived">{selectedIngredient?.unitOfMeasure ?? '—'}</output></label><label><span>Requested Unit</span><select value={draft.requestedUnit} aria-invalid={show('requestedUnit')} onPointerDown={mark('requestedUnit')} onKeyDown={mark('requestedUnit')} onBlur={blur('requestedUnit')} onChange={event => update('requestedUnit', event.target.value)}><option value="">Select requested unit</option>{CHANGE_REQUEST_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select>{show('requestedUnit') && <span className="sl-field-error" role="alert">{errors.requestedUnit}</span>}</label></>}
    {draft.requestType === 'ADD_MISSING_BATCH' && <><label><span>Date Received</span><input type="date" value={draft.dateReceived} max={draft.expirationDate || undefined} aria-invalid={show('dateReceived')} onPointerDown={mark('dateReceived')} onKeyDown={mark('dateReceived')} onBlur={blur('dateReceived')} onChange={event => update('dateReceived', event.target.value)} />{show('dateReceived') && <span className="sl-field-error" role="alert">{errors.dateReceived}</span>}</label><label><span>Quantity Received</span><input type="number" min="0" step="any" value={draft.quantityReceived} aria-invalid={show('quantityReceived')} onPointerDown={mark('quantityReceived')} onKeyDown={mark('quantityReceived')} onBlur={blur('quantityReceived')} onChange={event => update('quantityReceived', event.target.value)} />{show('quantityReceived') && <span className="sl-field-error" role="alert">{errors.quantityReceived}</span>}</label><label><span>Unit</span><output className="sl-staff-my-request-derived">{selectedIngredient?.unitOfMeasure ?? '—'}</output></label><label><span>Expiration Date</span><input type="date" value={draft.expirationDate} min={draft.dateReceived || undefined} aria-invalid={show('expirationDate')} onPointerDown={mark('expirationDate')} onKeyDown={mark('expirationDate')} onBlur={blur('expirationDate')} onChange={event => update('expirationDate', event.target.value)} />{show('expirationDate') && <span className="sl-field-error" role="alert">{errors.expirationDate}</span>}</label><label><span>Unit Cost (Optional)</span><input type="number" min="0" step="0.01" value={draft.unitCost} aria-invalid={show('unitCost')} onPointerDown={mark('unitCost')} onKeyDown={mark('unitCost')} onBlur={blur('unitCost')} onChange={event => update('unitCost', event.target.value)} />{show('unitCost') && <span className="sl-field-error" role="alert">{errors.unitCost}</span>}</label></>}
    {draft.requestType === 'OTHER' && <label className="sl-staff-my-request-full"><span>Request Description</span><textarea value={draft.requestDescription} aria-invalid={show('requestDescription')} onPointerDown={mark('requestDescription')} onKeyDown={mark('requestDescription')} onBlur={blur('requestDescription')} onChange={event => update('requestDescription', event.target.value)} />{show('requestDescription') && <span className="sl-field-error" role="alert">{errors.requestDescription}</span>}</label>}
    {draft.requestType && <label className="sl-staff-my-request-full"><span>Reason</span><textarea value={draft.reason} aria-invalid={show('reason')} onPointerDown={mark('reason')} onKeyDown={mark('reason')} onBlur={blur('reason')} onChange={event => update('reason', event.target.value)} />{show('reason') && <span className="sl-field-error" role="alert">{errors.reason}</span>}</label>}
  </div></InventoryStaffModalForm></InventoryStaffModal>
  <ChangeRequestDetailsDialog request={detail} onDismiss={() => setDetail(null)} returnFocus={addButton} /></>;
}
export default function ChangeRequests() { const { user } = useApplicationWorkspace(); return user.role === 'Inventory Staff' ? <InventoryStaffChangeRequests /> : <ModulePage moduleId="ChangeRequests" />; }
