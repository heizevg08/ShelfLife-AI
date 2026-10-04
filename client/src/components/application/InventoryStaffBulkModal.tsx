import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { FileInput, PackagePlus, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { createStockIns, listInventoryBatches, type InventoryBatch, type StockInInput } from '../../services/inventory-batches';
import type { StockInIngredient } from '../../services/ingredients';
import { createUsageRecords, type UsageInput } from '../../services/usage-records';
import { createWasteRecords, type WasteInput, type WasteReason } from '../../services/waste-records';
import { isValidDateOnlyInput, localDateInputValue } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { InventoryStaffModal, InventoryStaffModalForm } from './InventoryStaffModal';
import { Dialog } from './Dialog';

type Mode = 'stock' | 'usage' | 'waste';
type Draft = { key: string; ingredientId: string; batchId: string; quantity: string; date: string; expirationDate: string; unitCost: string; reason: WasteReason | '' };
type Field = 'ingredientId' | 'batchId' | 'quantity' | 'date' | 'expirationDate' | 'unitCost' | 'reason';
type RowErrors = Partial<Record<Field, string>>;
const MAX_ITEMS = 25;
const reasons: WasteReason[] = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'];
let nextKey = 0;
const blank = (): Draft => ({ key: `recording-${++nextKey}`, ingredientId: '', batchId: '', quantity: '', date: '', expirationDate: '', unitCost: '', reason: '' });

const labels = {
  stock: { title: 'Add Stock-In', subtitle: 'Record one or more received inventory batches.', quantity: 'Quantity Received', date: 'Date Received', primary: 'Save Stock-In', Icon: PackagePlus },
  usage: { title: 'Record Usage', subtitle: 'Record ingredient consumption from one or more inventory batches.', quantity: 'Quantity Used', date: 'Date Used', primary: 'Save Usage Records', Icon: UtensilsCrossed },
  waste: { title: 'Record Waste', subtitle: 'Record one or more discarded ingredients.', quantity: 'Quantity Wasted', date: 'Date Wasted', primary: 'Save Waste Records', Icon: Trash2 },
} as const;

function validate(mode: Mode, row: Draft, today: string): RowErrors {
  const errors: RowErrors = {};
  if (!row.ingredientId) errors.ingredientId = 'Select an ingredient.';
  if (mode !== 'stock' && !row.batchId) errors.batchId = 'Select a batch ID.';
  const quantity = Number(row.quantity);
  if (!row.quantity.trim()) errors.quantity = `Enter the ${labels[mode].quantity.toLowerCase()}.`;
  else if (!Number.isFinite(quantity) || quantity <= 0) errors.quantity = 'Enter a quantity greater than 0.';
  if (!row.date) errors.date = `Select the ${labels[mode].date.toLowerCase()}.`;
  else if (!isValidDateOnlyInput(row.date)) errors.date = 'Enter a valid date.';
  else if (mode !== 'stock' && row.date > today) errors.date = `${labels[mode].date} cannot be in the future.`;
  if (mode === 'stock' && !row.expirationDate) errors.expirationDate = 'Select the expiration date.';
  else if (mode === 'stock' && row.date && row.expirationDate <= row.date) errors.expirationDate = 'Expiration date must be after the date received.';
  if (mode === 'stock' && row.unitCost && (!Number.isFinite(Number(row.unitCost)) || Number(row.unitCost) < 0)) errors.unitCost = 'Enter a unit cost of 0 or more.';
  if (mode === 'waste' && !row.reason) errors.reason = 'Select a waste reason.';
  return errors;
}

export function InventoryStaffBulkModal({ mode, open, busy: outerBusy = false, ingredients, onDismiss, onSaved, returnFocus }: { mode: Mode; open: boolean; busy?: boolean; ingredients: StockInIngredient[]; onDismiss: () => void; onSaved: () => Promise<void> | void; returnFocus: RefObject<HTMLElement | null> }) {
  const config = labels[mode], Icon = config.Icon, form = useRef<HTMLFormElement>(null);
  const interacted = useRef<Record<string, Partial<Record<Field, boolean>>>>({});
  const [rows, setRows] = useState<Draft[]>([blank()]);
  const [batches, setBatches] = useState<Record<string, InventoryBatch[]>>({});
  const [touched, setTouched] = useState<Record<string, Partial<Record<Field, boolean>>>>({});
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const today = localDateInputValue();
  const reset = () => { interacted.current = {}; setRows([blank()]); setBatches({}); setTouched({}); setErrors({}); setMessage(''); };
  useEffect(() => { if (open) reset(); }, [open, mode]);
  const update = (key: string, field: Field, value: string) => {
    interacted.current[key] = { ...interacted.current[key], [field]: true };
    setRows(current => current.map(row => {
      if (row.key !== key) return row;
      const next = { ...row, [field]: value, ...(field === 'ingredientId' ? { batchId: '' } : {}) } as Draft;
      const ingredient = ingredients.find(item => item.id === (field === 'ingredientId' ? value : next.ingredientId));
      if (mode === 'stock' && field === 'ingredientId') next.unitCost = ingredient?.standardUnitCost === undefined ? '' : String(ingredient.standardUnitCost);
      if (mode === 'stock' && (field === 'ingredientId' || field === 'date') && next.date && ingredient?.defaultShelfLifeDays) {
        const expiration = new Date(`${next.date}T00:00:00`); expiration.setDate(expiration.getDate() + ingredient.defaultShelfLifeDays); next.expirationDate = localDateInputValue(expiration);
      }
      return next;
    }));
    setErrors(current => ({ ...current, [key]: { ...current[key], [field]: undefined, ...(field === 'ingredientId' ? { batchId: undefined } : {}) } }));
    if (field === 'ingredientId' && mode !== 'stock' && value && !batches[value]) {
      void listInventoryBatches({ page: 1, pageSize: 150, ingredientId: value, sort: 'fefo' }).then(result => setBatches(current => ({ ...current, [value]: result.items }))).catch(() => setBatches(current => ({ ...current, [value]: [] })));
    }
  };
  const blur = (row: Draft, field: Field) => {
    if (!interacted.current[row.key]?.[field]) return;
    setTouched(current => ({ ...current, [row.key]: { ...current[row.key], [field]: true } }));
    setErrors(current => ({ ...current, [row.key]: { ...current[row.key], [field]: validate(mode, row, today)[field] } }));
  };
  const interaction = (row: Draft, field: Field) => ({ onPointerDown: () => { interacted.current[row.key] = { ...interacted.current[row.key], [field]: true }; }, onKeyDown: () => { interacted.current[row.key] = { ...interacted.current[row.key], [field]: true }; } });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = Object.fromEntries(rows.map(row => [row.key, validate(mode, row, today)]));
    if (Object.values(next).some(row => Object.keys(row).length)) {
      setErrors(next); setTouched(Object.fromEntries(rows.map(row => [row.key, Object.fromEntries(Object.keys(next[row.key] ?? {}).map(field => [field, true]))])));
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    setBusy(true); setMessage('');
    try {
      if (mode === 'stock') await createStockIns(rows.map(row => ({ ingredientId: row.ingredientId, dateReceived: row.date, quantity: Number(row.quantity), expirationDate: row.expirationDate, ...(row.unitCost ? { unitCost: Number(row.unitCost) } : {}) } satisfies StockInInput)));
      if (mode === 'usage') await createUsageRecords(rows.map(row => ({ ingredientId: row.ingredientId, batchId: row.batchId, dateUsed: row.date, quantityUsed: Number(row.quantity) } satisfies UsageInput)));
      if (mode === 'waste') await createWasteRecords(rows.map(row => ({ ingredientId: row.ingredientId, batchId: row.batchId, dateWasted: row.date, quantityWasted: Number(row.quantity), reason: row.reason as WasteReason } satisfies WasteInput)));
      reset(); onDismiss(); await onSaved();
    } catch (error) {
      if (error instanceof ApiError) {
        const serverErrors: Record<string, RowErrors> = {};
        for (const detail of error.details) {
          const match = /^items\.(\d+)\.(.+)$/.exec(detail.field);
          if (!match) continue;
          const row = rows[Number(match[1])]; if (!row) continue;
          const apiField = match[2] === 'quantityUsed' || match[2] === 'quantityWasted' ? 'quantity' : match[2] === 'dateUsed' || match[2] === 'dateWasted' || match[2] === 'dateReceived' ? 'date' : match[2];
          serverErrors[row.key] = { ...serverErrors[row.key], [apiField as Field]: detail.message };
        }
        setErrors(serverErrors); setMessage(Object.keys(serverErrors).length ? '' : error.message);
      } else setMessage(`Unable to save ${config.title.toLowerCase()}. Try again.`);
    } finally { setBusy(false); }
  };
  const visibleError = (row: Draft, field: Field) => touched[row.key]?.[field] && errors[row.key]?.[field];
  const errorNode = (row: Draft, field: Field) => visibleError(row, field) ? <span id={`${row.key}-${field}-error`} className="sl-field-error" role="alert">{errors[row.key]?.[field]}</span> : null;
  const validation = (row: Draft, field: Field) => visibleError(row, field) ? { 'aria-invalid': true as const, 'aria-describedby': `${row.key}-${field}-error` } : {};
  const close = () => { if (!busy && !outerBusy) { reset(); onDismiss(); } };
  const removeRow = (key: string) => {
    delete interacted.current[key];
    setTouched(current => { const next = { ...current }; delete next[key]; return next; });
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setRows(current => current.filter(item => item.key !== key));
  };
  const items = <div className="sl-bulk-recording-list">{rows.map((row, index) => {
        const ingredient = ingredients.find(item => item.id === row.ingredientId), rowBatches = batches[row.ingredientId] ?? [], batch = rowBatches.find(item => item.id === row.batchId);
        const field = (name: Field, label: string, control: ReactNode, className = '') => <label className={className}><span>{label}</span>{control}{errorNode(row, name)}</label>;
        const ingredientField = field('ingredientId', 'Ingredient', <select value={row.ingredientId} onChange={event => update(row.key, 'ingredientId', event.target.value)} onBlur={() => blur(row, 'ingredientId')} {...interaction(row, 'ingredientId')} {...validation(row, 'ingredientId')}><option value="">Search or select ingredient...</option>{ingredients.map(item => <option key={item.id} value={item.id}>{formatHumanReadableText(item.name)}</option>)}</select>);
        const batchField = mode !== 'stock' ? field('batchId', 'Batch ID', <select value={row.batchId} disabled={!row.ingredientId} onChange={event => update(row.key, 'batchId', event.target.value)} onBlur={() => blur(row, 'batchId')} {...interaction(row, 'batchId')} {...validation(row, 'batchId')}><option value="">Select batch ID...</option>{rowBatches.filter(item => item.quantity > 0).map(item => <option key={item.id} value={item.id}>{item.batchID}</option>)}</select>) : null;
        const quantityField = field('quantity', config.quantity, <input inputMode="decimal" value={row.quantity} onChange={event => update(row.key, 'quantity', event.target.value)} onBlur={() => blur(row, 'quantity')} {...interaction(row, 'quantity')} placeholder="Enter quantity" {...validation(row, 'quantity')}/>);
        const unitHelpId = `${row.key}-unit-help`;
        const unitField = <label className="sl-derived-unit-field"><span>Unit</span><output className="sl-staff-derived-unit" aria-describedby={unitHelpId}>{batch?.unit ?? ingredient?.unitOfMeasure ?? '—'}</output><small id={unitHelpId} className="sl-field-helper">Auto-filled from ingredient</small></label>;
        const dateField = field('date', config.date, <input type="date" max={mode === 'stock' ? undefined : today} value={row.date} onChange={event => update(row.key, 'date', event.target.value)} onBlur={() => blur(row, 'date')} {...interaction(row, 'date')} {...validation(row, 'date')}/>);
        return <fieldset key={row.key} aria-labelledby={`${row.key}-title`} className={`sl-bulk-recording-row sl-bulk-recording-row--${mode}`}><div className="sl-bulk-recording-header"><h3 id={`${row.key}-title`}>Item {index + 1}</h3>{index > 0 && <button type="button" className="sl-bulk-recording-remove" aria-label={`Remove item ${index + 1}`} onClick={() => removeRow(row.key)}><X size={16} aria-hidden="true"/> Remove</button>}</div>
          {mode === 'stock' ? <div className="sl-creation-form-grid"><div className="sl-creation-form-row">{dateField}{ingredientField}</div><div className="sl-creation-form-row">{quantityField}{unitField}</div><div className="sl-creation-form-row">{field('expirationDate', 'Expiration Date', <input type="date" min={row.date || undefined} value={row.expirationDate} onChange={event => update(row.key, 'expirationDate', event.target.value)} onBlur={() => blur(row, 'expirationDate')} {...interaction(row, 'expirationDate')} {...validation(row, 'expirationDate')}/>)}{field('unitCost', 'Unit Cost (Optional)', <span className="sl-currency-input sl-stockin-currency-input"><span aria-hidden="true">₱</span><input inputMode="decimal" value={row.unitCost} onChange={event => update(row.key, 'unitCost', event.target.value)} onBlur={() => blur(row, 'unitCost')} {...interaction(row, 'unitCost')} placeholder="0.00" {...validation(row, 'unitCost')}/></span>)}</div></div> : mode === 'usage' ? <div className="sl-creation-form-grid"><div className="sl-creation-form-row">{ingredientField}{batchField}</div><div className="sl-creation-form-row">{dateField}{quantityField}</div><div className="sl-creation-form-row">{unitField}</div></div> : <div className="sl-bulk-waste-item"><div className="sl-staff-waste-form-row">{ingredientField}{batchField}</div><div className="sl-staff-waste-form-row">{quantityField}{unitField}</div><div className="sl-staff-waste-form-row">{dateField}{field('reason', 'Reason', <select value={row.reason} onChange={event => update(row.key, 'reason', event.target.value)} onBlur={() => blur(row, 'reason')} {...interaction(row, 'reason')} {...validation(row, 'reason')}><option value="">Select reason...</option>{reasons.map(reason => <option key={reason}>{reason}</option>)}</select>)}</div></div>}
        </fieldset>;
      })}</div>;
  const addButton = <button type="button" className="sl-button sl-bulk-recording-add" disabled={rows.length >= MAX_ITEMS} onClick={() => setRows(current => [...current, blank()])}><Plus size={16} aria-hidden="true"/>Add another item</button>;
  if (mode === 'waste') return <InventoryStaffModal open={open} busy={busy || outerBusy} showClose={false} className="sl-staff-waste-dialog sl-inventory-staff-bulk-dialog" title={config.title} subtitle="Enter the details of the discarded ingredient." Icon={Icon} onDismiss={close} returnFocus={returnFocus}><InventoryStaffModalForm formRef={form} onSubmit={submit} message={message} secondaryLabel="Cancel" onSecondary={close} primaryLabel="Save Waste Records" busy={busy || outerBusy} className="sl-staff-waste-form sl-inventory-staff-bulk-form">{items}{addButton}</InventoryStaffModalForm></InventoryStaffModal>;
  const entryClass = mode === 'stock' ? 'sl-stockin-entry' : 'sl-usage-entry';
  return <Dialog open={open} busy={busy || outerBusy} showClose={false} className={`sl-add-user-dialog sl-account-reference-dialog ${entryClass}-modal sl-inventory-staff-bulk-dialog`} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Icon size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">{config.title}</span><small>{config.subtitle}</small></span></span>} onDismiss={close} returnFocus={returnFocus} actions={<span className="sl-creation-form-actions"><button type="button" className="sl-button" disabled={busy || outerBusy} onClick={close}>Cancel</button><button type="submit" form={`${entryClass}-bulk-form`} className="sl-button sl-button-primary" disabled={busy || outerBusy}>{config.primary}</button></span>}><form id={`${entryClass}-bulk-form`} ref={form} className={`${entryClass}-form sl-creation-form sl-inventory-staff-bulk-form`} noValidate onSubmit={submit}>{items}{addButton}{message && <p className="sl-inline-notice" role="status">{message}</p>}</form></Dialog>;
}
