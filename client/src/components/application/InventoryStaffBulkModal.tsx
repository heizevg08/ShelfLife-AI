import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { FileInput, PackagePlus, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { createStockIns, listInventoryBatches, type InventoryBatch, type StockInInput } from '../../services/inventory-batches';
import type { StockInIngredient } from '../../services/ingredients';
import { createUsageRecords, type UsageInput } from '../../services/usage-records';
import { createWasteRecords, type WasteInput, type WasteReason } from '../../services/waste-records';
import { isValidDateOnlyInput, localDateInputValue } from '../../utils/date-time';
import { InventoryStaffModal, InventoryStaffModalForm } from './InventoryStaffModal';

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
  const config = labels[mode], form = useRef<HTMLFormElement>(null);
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
  return <InventoryStaffModal open={open} busy={busy || outerBusy} showClose={false} className="sl-inventory-staff-bulk-dialog" title={config.title} subtitle={config.subtitle} Icon={config.Icon} onDismiss={close} returnFocus={returnFocus}>
    <InventoryStaffModalForm formRef={form} onSubmit={submit} message={message} secondaryLabel="Cancel" onSecondary={close} primaryLabel={config.primary} busy={busy || outerBusy} className="sl-inventory-staff-bulk-form">
      <div className="sl-bulk-recording-list">{rows.map((row, index) => {
        const ingredient = ingredients.find(item => item.id === row.ingredientId), rowBatches = batches[row.ingredientId] ?? [], batch = rowBatches.find(item => item.id === row.batchId);
        return <fieldset key={row.key} className="sl-bulk-recording-row"><legend>Item {index + 1}</legend>{rows.length > 1 && <button type="button" className="sl-bulk-recording-remove" aria-label={`Remove item ${index + 1}`} onClick={() => setRows(current => current.filter(item => item.key !== row.key))}><X size={16} aria-hidden="true"/> Remove</button>}
          <div className="sl-bulk-recording-grid"><label><span>Ingredient</span><select value={row.ingredientId} onChange={event => update(row.key, 'ingredientId', event.target.value)} onBlur={() => blur(row, 'ingredientId')} {...interaction(row, 'ingredientId')} {...validation(row, 'ingredientId')}><option value="">Search or select ingredient...</option>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errorNode(row, 'ingredientId')}</label>
          {mode !== 'stock' && <label><span>Batch ID</span><select value={row.batchId} disabled={!row.ingredientId} onChange={event => update(row.key, 'batchId', event.target.value)} onBlur={() => blur(row, 'batchId')} {...interaction(row, 'batchId')} {...validation(row, 'batchId')}><option value="">Select batch ID...</option>{rowBatches.filter(item => item.quantity > 0).map(item => <option key={item.id} value={item.id}>{item.batchID}</option>)}</select>{errorNode(row, 'batchId')}</label>}
          <label><span>{config.quantity}</span><input inputMode="decimal" value={row.quantity} onChange={event => update(row.key, 'quantity', event.target.value)} onBlur={() => blur(row, 'quantity')} {...interaction(row, 'quantity')} placeholder="Enter quantity" {...validation(row, 'quantity')}/>{errorNode(row, 'quantity')}</label>
          <label><span>Unit</span><output className="sl-staff-derived-unit">{batch?.unit ?? ingredient?.unitOfMeasure ?? '—'}</output></label>
          <label><span>{config.date}</span><input type="date" max={mode === 'stock' ? undefined : today} value={row.date} onChange={event => update(row.key, 'date', event.target.value)} onBlur={() => blur(row, 'date')} {...interaction(row, 'date')} {...validation(row, 'date')}/>{errorNode(row, 'date')}</label>
          {mode === 'stock' && <label><span>Expiration Date</span><input type="date" min={row.date || undefined} value={row.expirationDate} onChange={event => update(row.key, 'expirationDate', event.target.value)} onBlur={() => blur(row, 'expirationDate')} {...interaction(row, 'expirationDate')} {...validation(row, 'expirationDate')}/>{errorNode(row, 'expirationDate')}</label>}
          {mode === 'stock' && <label><span>Unit Cost (Optional)</span><span className="sl-currency-input"><span aria-hidden="true">₱</span><input inputMode="decimal" value={row.unitCost} onChange={event => update(row.key, 'unitCost', event.target.value)} onBlur={() => blur(row, 'unitCost')} {...interaction(row, 'unitCost')} placeholder="0.00" {...validation(row, 'unitCost')}/></span>{errorNode(row, 'unitCost')}</label>}
          {mode === 'waste' && <label><span>Reason</span><select value={row.reason} onChange={event => update(row.key, 'reason', event.target.value)} onBlur={() => blur(row, 'reason')} {...interaction(row, 'reason')} {...validation(row, 'reason')}><option value="">Select reason...</option>{reasons.map(reason => <option key={reason}>{reason}</option>)}</select>{errorNode(row, 'reason')}</label>}</div>
        </fieldset>;
      })}</div>
      <button type="button" className="sl-button sl-bulk-recording-add" disabled={rows.length >= MAX_ITEMS} onClick={() => setRows(current => [...current, blank()])}><Plus size={16} aria-hidden="true"/>Add Item</button>
    </InventoryStaffModalForm>
  </InventoryStaffModal>;
}
