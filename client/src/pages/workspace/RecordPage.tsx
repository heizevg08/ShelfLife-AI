import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/apiClient';
import { listIngredients, type Ingredient } from '../../services/ingredients';
import { batchVersion, correctInventoryRecord, createInventoryRecord, eligibleBatches, listInventoryRecords, voidInventoryRecord, type EligibleBatch, type InventoryRecord, type RecordKind } from '../../services/inventoryRecords';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { DataState, PageHeader, Pagination, Status } from '../../components/application/primitives';
import { manilaToday, recordFormError } from './recordValidation';

const REASONS = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'];
export function RecordPage({ kind }: { kind: 'usage' | 'waste' }) {
  const endpoint: RecordKind = kind === 'usage' ? 'usage-records' : 'waste-records';
  const { user } = useApplicationWorkspace();
  const canCreate = ['Inventory Manager', 'Inventory Staff'].includes(user.role);
  const canManage = user.role === 'Inventory Manager';
  const canRead = user.role !== 'Inventory Staff';
  const [ingredients, setIngredients] = useState<Ingredient[]>([]), [batches, setBatches] = useState<EligibleBatch[]>([]), [records, setRecords] = useState<InventoryRecord[]>([]);
  const [ingredientId, setIngredientId] = useState(''), [batchId, setBatchId] = useState(''), [quantity, setQuantity] = useState(''), [recordedAt, setRecordedAt] = useState(manilaToday), [reason, setReason] = useState(''), [notes, setNotes] = useState('');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const loadIngredients = () => {
    setError('');
    return listIngredients(1, 100).then(result => { setIngredients(result.items); setError(''); }).catch(() => setError('Unable to load ingredients.'));
  };
  const loadHistory = () => {
    if (!canRead) return Promise.resolve();
    setError(''); setLoaded(false);
    return listInventoryRecords(endpoint, page).then(result => { setRecords(result.items); setTotal(result.total); setError(''); }).catch(error => setError(error instanceof ApiError ? error.message : 'Unable to load records.')).finally(() => setLoaded(true));
  };
  const loadBatches = (nextIngredientId = ingredientId) => {
    if (!nextIngredientId) { setBatches([]); setBatchId(''); return Promise.resolve(); }
    setError('');
    return eligibleBatches(endpoint, nextIngredientId).then(result => {
      setBatches(result.items);
      setBatchId(current => result.items.some(batch => batch.id === current) ? current : result.items[0]?.id ?? '');
      setError('');
    }).catch(error => setError(error instanceof ApiError ? error.message : 'Unable to load FEFO batches.'));
  };
  useEffect(() => { void loadIngredients(); }, []);
  useEffect(() => { void loadHistory(); }, [endpoint, page, canRead]);
  useEffect(() => { void loadBatches(); }, [endpoint, ingredientId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const formError = recordFormError(kind, quantity, reason, notes, recordedAt);
    if (!ingredientId || !batchId) { setError('Select an ingredient and an available batch.'); return; }
    if (formError) { setError(formError); return; }
    setBusy(true);
    try {
      await createInventoryRecord(endpoint, { ingredientId, batchId, quantity, recordedAt, notes, ...(kind === 'waste' ? { reason } : {}) });
      setQuantity(''); setNotes(''); await Promise.all([loadHistory(), loadBatches()]);
    }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Unable to save the record.'); }
    finally { setBusy(false); }
  };
  const voidRecord = async (record: InventoryRecord) => {
    if (!window.confirm('Void this record and restore its quantity to the batch?')) return;
    setError(''); setBusy(true);
    try { const current = await batchVersion(record.batchId); await voidInventoryRecord(endpoint, record.id, current.batch.version); await Promise.all([loadHistory(), loadBatches()]); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Unable to void the record.'); }
    finally { setBusy(false); }
  };
  const correctRecord = async (record: InventoryRecord) => {
    const correctedQuantity = window.prompt('Corrected quantity (up to 3 decimal places):', record.quantity);
    if (correctedQuantity === null) return;
    const reason = window.prompt('Correction reason (required):', '');
    if (reason === null) return;
    const formError = recordFormError(kind, correctedQuantity, record.reason ?? '', reason);
    if (formError || !reason.trim()) { setError(formError || 'Provide a correction reason.'); return; }
    setError(''); setBusy(true);
    try { const current = await batchVersion(record.batchId); await correctInventoryRecord(endpoint, record.id, current.batch.version, correctedQuantity, reason); await Promise.all([loadHistory(), loadBatches()]); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Unable to correct the record.'); }
    finally { setBusy(false); }
  };
  const selected = batches.find(batch => batch.id === batchId);
  const title = kind === 'usage' ? 'Usage Records' : 'Waste Records';
  return <main className="sl-admin-view"><PageHeader title={title} description={canRead ? 'Record stock movement and review the available history.' : 'Record stock movement against an active, eligible batch.'} />
    {error && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{error}</p>}
    {canCreate && <section className="sl-card"><div className="sl-card-header"><h2 className="sl-section-title">Record {kind === 'usage' ? 'usage' : 'waste'}</h2><Status tone="brand">FEFO batch selected by default</Status></div><div className="sl-card-body">
      <form className="sl-form-grid" noValidate onSubmit={submit}>
        <label><span className="sl-form-label">Ingredient</span><select className="sl-admin-input" value={ingredientId} disabled={busy} onChange={event => setIngredientId(event.target.value)}><option value="">Select ingredient</option>{ingredients.map(ingredient => <option value={ingredient.id} key={ingredient.id}>{ingredient.name}</option>)}</select></label>
        <label><span className="sl-form-label">Batch</span><select className="sl-admin-input" value={batchId} disabled={busy || !ingredientId} onChange={event => setBatchId(event.target.value)}><option value="">Select batch</option>{batches.map(batch => <option value={batch.id} key={batch.id}>{batch.id.slice(-8)} · {batch.quantity} {batch.unit}</option>)}</select></label>
        <label><span className="sl-form-label">Quantity</span><input className="sl-admin-input" inputMode="decimal" maxLength={22} value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label>
        <label><span className="sl-form-label">Recorded date</span><input className="sl-admin-input" type="date" max={manilaToday()} value={recordedAt} disabled={busy} onChange={event => setRecordedAt(event.target.value)} /></label>
        {kind === 'waste' && <label><span className="sl-form-label">Reason</span><select className="sl-admin-input" value={reason} disabled={busy} onChange={event => setReason(event.target.value)}><option value="">Select reason</option>{REASONS.map(value => <option key={value}>{value}</option>)}</select></label>}
        <label><span className="sl-form-label">Notes{kind === 'waste' && reason === 'Other' ? ' (required)' : ' (optional)'}</span><input className="sl-admin-input" maxLength={500} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} /></label>
        {selected && <p className="sl-supporting">Available: {selected.quantity} {selected.unit} · unit cost: ₱{selected.unitCost}</p>}
        <div><button className="sl-button sl-button-primary" type="submit" disabled={busy}>Save record</button></div>
      </form>
    </div></section>}
    {canRead && <section className="sl-card"><div className="sl-card-header"><h2 className="sl-section-title">History</h2></div><div className="sl-card-body">{!loaded ? <DataState kind="loading" title="Loading records" description="Retrieving the current page." /> : <div className="sl-table-scroll"><table className="sl-data-table"><thead><tr><th>Date</th><th>Batch</th><th>Quantity</th><th>Cost</th><th>Notes</th><th>Type</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{records.map(record => <tr key={record.id}><td>{record.recordedAt}</td><td>{record.batchId.slice(-8)}</td><td>{record.quantity} {record.unit}</td><td>₱{record.totalCostSnapshot}</td><td>{record.reason ? `${record.reason}: ` : ''}{record.notes || '—'}</td><td>{record.type}</td>{canManage && <td>{record.isActive && record.type === 'original' && <><button type="button" className="sl-button" disabled={busy} onClick={() => void correctRecord(record)}>Correct</button><button type="button" className="sl-button" disabled={busy} onClick={() => void voidRecord(record)}>Void</button></>}</td>}</tr>)}{records.length === 0 && <tr><td colSpan={canManage ? 7 : 6}>No records found.</td></tr>}</tbody></table></div>}<Pagination page={page} pageSize={25} total={total} itemLabel="records" onPageChange={setPage} /></div></section>}
  </main>;
}
