import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, FileInput, Plus, XCircle } from 'lucide-react';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { Card, DataState, PageHeader, Status, SummaryCards } from '../../components/application/primitives';
import { approveChangeRequest, createChangeRequest, getManagerChangeRequestSummary, getStaffChangeRequestSummary, listChangeRequestIngredients, listChangeRequests, rejectChangeRequest, type ChangeRequest, type ChangeRequestInput, type ChangeRequestSummary } from '../../services/changeRequests';

const types: { value: ChangeRequestInput['requestType']; label: string }[] = [
  { value: 'MINIMUM_STOCK_CHANGE', label: 'Minimum stock' }, { value: 'STANDARD_UNIT_COST_CHANGE', label: 'Standard unit cost' },
  { value: 'CATEGORY_CHANGE', label: 'Category' }, { value: 'BRAND_CHANGE', label: 'Brand' }, { value: 'DESCRIPTION_CHANGE', label: 'Description' },
  { value: 'UNIT_OF_MEASURE_CHANGE', label: 'Unit of measure' }, { value: 'DEFAULT_SHELF_LIFE_CHANGE', label: 'Default shelf life' },
];
const empty = (): ChangeRequestInput => ({ requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: '', requestedValue: '', reason: '' });
const human = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

export default function ChangeRequests() {
  const { user } = useApplicationWorkspace();
  const [items, setItems] = useState<ChangeRequest[]>([]), [summary, setSummary] = useState<ChangeRequestSummary | null>(null), [ingredients, setIngredients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0), [form, setForm] = useState(empty), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null), [reviewNote, setReviewNote] = useState('');
  const staff = user.role === 'Inventory Staff', manager = user.role === 'Inventory Manager';
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    const summaryCall = staff ? getStaffChangeRequestSummary(abort.signal) : manager ? getManagerChangeRequestSummary(abort.signal) : Promise.resolve(null);
    Promise.all([listChangeRequests('', abort.signal), summaryCall, ...(staff ? [listChangeRequestIngredients(abort.signal)] : [])]).then(([page, liveSummary, options]) => {
      if (abort.signal.aborted) return; setItems(page.items); setSummary(liveSummary); if (options) setIngredients(options.items);
    }).catch(value => { if (!abort.signal.aborted) setError(value instanceof Error ? value.message : 'Could not load change requests.'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [staff, manager, reload]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await createChangeRequest(form); setForm(empty()); setNotice('Change request submitted.'); setReload(value => value + 1); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not submit the request.'); }
    finally { setBusy(false); }
  };
  const review = async (outcome: 'approve' | 'reject') => {
    if (!reviewing) return; setBusy(true); setError(''); setNotice('');
    try { if (outcome === 'approve') await approveChangeRequest(reviewing.id, reviewing.version, reviewNote); else await rejectChangeRequest(reviewing.id, reviewing.version, reviewNote); setNotice(`Request ${outcome === 'approve' ? 'approved' : 'rejected'}.`); setReviewing(null); setReviewNote(''); setReload(value => value + 1); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not review the request.'); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeader title={staff ? 'My Change Requests' : 'Change Requests'} description={staff ? 'Submit ingredient changes for Inventory Manager review.' : manager ? 'Review typed ingredient change requests.' : 'Read-only typed change request history.'} />
    <div className="sl-admin-view sl-change-requests-page">
      {summary && <SummaryCards items={[
        { label: 'Total requests', value: String(summary.total), detail: 'Typed requests', tone: 'brand', trend: 'line' },
        { label: 'Pending', value: String(summary.pending), detail: 'Awaiting review', tone: 'attention', trend: 'segments' },
        { label: 'Approved', value: String(summary.approved), detail: 'Completed', tone: 'success', trend: 'accuracy' },
        { label: 'Rejected', value: String(summary.rejected), detail: 'Closed', tone: 'critical', trend: 'bars' },
      ]} />}
      {notice && <p className="sl-inline-notice" role="status">{notice}</p>}
      {error && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{error}</p>}
      {staff && <Card id="typed-change-request-form" title="Submit a change request" action={<FileInput size={18} aria-hidden="true" />}>
        <form className="sl-live-ingredient-form sl-change-request-form" onSubmit={submit}>
          <div className="sl-form-grid sl-change-request-fields">
            <label>Ingredient<select className="sl-admin-input" value={form.ingredientId} required disabled={busy} onChange={event => setForm(current => ({ ...current, ingredientId: event.target.value }))}><option value="">Select an ingredient</option>{ingredients.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Change type<select className="sl-admin-input" value={form.requestType} disabled={busy} onChange={event => setForm(current => ({ ...current, requestType: event.target.value as ChangeRequestInput['requestType'], requestedValue: '' }))}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label>Requested value<input className="sl-admin-input" value={form.requestedValue} required maxLength={500} disabled={busy} onChange={event => setForm(current => ({ ...current, requestedValue: event.target.value }))} /></label>
            <label>Reason<textarea className="sl-admin-input" value={form.reason} required maxLength={500} rows={3} disabled={busy} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} /></label>
          </div>
          <button className="sl-button sl-button-primary" disabled={busy || !form.ingredientId} type="submit"><Plus size={16} aria-hidden="true" />{busy ? 'Submitting…' : 'Submit request'}</button>
        </form>
      </Card>}
      <Card id="typed-change-request-list" title={staff ? 'Your request history' : 'Request history'}>
        {loading ? <DataState kind="loading" title="Loading requests" description="Fetching current request history." /> : items.length === 0 ? <DataState kind="empty" title="No requests yet" description="No matching change requests are available." /> : <div className="sl-table-scroll" role="region" aria-label="Change requests" tabIndex={0}><table className="sl-data-table"><thead><tr><th>Request ID</th><th>Type</th><th>Requested value</th><th>Status</th><th>Submitted</th>{manager && <th>Review</th>}</tr></thead><tbody>{items.map(request => <tr key={request.id}><td>{request.requestID ?? 'Legacy record'}</td><td>{human(request.requestType)}</td><td>{request.requestedValue}</td><td><Status tone={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'critical' : 'attention'}>{human(request.status)}</Status>{request.readOnly && <small className="sl-supporting"> Read-only history</small>}</td><td>{new Date(request.createdAt).toLocaleDateString()}</td>{manager && <td>{request.status === 'PENDING' && !request.readOnly ? <button className="sl-button" type="button" onClick={() => { setReviewing(request); setReviewNote(''); }}>Review</button> : '—'}</td>}</tr>)}</tbody></table></div>}
      </Card>
      {manager && reviewing && <Card id="typed-change-request-review" title={`Review ${reviewing.requestID}`}>
        <p>Requested change: <strong>{human(reviewing.targetField ?? '')}</strong> from <strong>{reviewing.currentValue}</strong> to <strong>{reviewing.requestedValue}</strong>.</p>
        <label>Review note<textarea className="sl-admin-input" value={reviewNote} maxLength={500} rows={3} disabled={busy} onChange={event => setReviewNote(event.target.value)} /></label>
        <div className="sl-row-actions"><button type="button" className="sl-button" disabled={busy || !reviewNote.trim()} onClick={() => void review('reject')}><XCircle size={16} aria-hidden="true" />Reject</button><button type="button" className="sl-button sl-button-primary" disabled={busy} onClick={() => void review('approve')}><CheckCircle2 size={16} aria-hidden="true" />Approve</button></div>
      </Card>}
    </div>
  </>;
}
