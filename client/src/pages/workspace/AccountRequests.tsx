import { useEffect, useState, type FormEvent } from 'react';
import { Check, Clock3, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Card, DataState, PageHeader, Status } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { Dialog } from '../../components/application/Dialog';
import { ApiError } from '../../services/apiClient';
import { createAccountRequest, deleteAccountRequest, listAccountRequests, reviewAccountRequest, type AccountRequest, type AccountRequestInput } from '../../services/accountRequests';
import type { SessionUser } from '../../services/auth';

const blank: AccountRequestInput = { firstName: '', lastName: '', email: '', role: 'Inventory Staff' };
const requestableRoles: Exclude<SessionUser['role'], 'Super Admin'>[] = ['Admin', 'Inventory Manager', 'Inventory Staff'];
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/;
const personNamePattern = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;

export default function AccountRequestsPage() {
  const { user } = useApplicationWorkspace();
  const reviewer = user.role === 'Admin' || user.role === 'Super Admin';
  const requester = user.role === 'Inventory Staff' || user.role === 'Inventory Manager';
  const [form, setForm] = useState<AccountRequestInput>({ ...blank, role: user.role === 'Admin' ? 'Inventory Manager' : 'Inventory Staff' });
  const [items, setItems] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AccountRequest | null>(null);
  const [password, setPassword] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setLoadError('');
    listAccountRequests(abort.signal).then(result => { if (!abort.signal.aborted) setItems(result.items); }).catch(error => {
      if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Account requests could not be loaded.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [reload]);

  const setValue = (key: keyof AccountRequestInput, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: '' }));
    setActionError(''); setMessage('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!form.firstName.trim() || form.firstName.trim().length > 25 || !personNamePattern.test(form.firstName.trim())) errors.firstName = 'Use 1–25 letters, spaces, apostrophes, or hyphens.';
    if (!form.lastName.trim() || form.lastName.trim().length > 25 || !personNamePattern.test(form.lastName.trim())) errors.lastName = 'Use 1–25 letters, spaces, apostrophes, or hyphens.';
    if (!emailPattern.test(form.email.trim().toLowerCase())) errors.email = 'Enter a valid shelflife.com email.';
    if (user.role !== 'Admin' && !['Inventory Staff', 'Inventory Manager'].includes(form.role)) errors.role = 'Select a staff or manager role.';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setBusy(true); setActionError(''); setMessage('');
    try {
      await createAccountRequest({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase() });
      setForm({ ...blank, role: user.role === 'Admin' ? 'Inventory Manager' : 'Inventory Staff' });
      setMessage(user.role === 'Admin' ? 'Request submitted. A Super Admin must approve it before the account is created.' : 'Request submitted for Admin or Super Admin approval.');
      setReload(value => value + 1);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = Object.fromEntries(error.details.map(detail => [detail.field, detail.message]));
        setFieldErrors(details); setActionError(Object.keys(details).length ? 'Check the highlighted fields.' : error.message);
      } else setActionError('The request could not be submitted. Check your connection and try again.');
    } finally { setBusy(false); }
  };
  const canReview = (request: AccountRequest) => user.role === 'Super Admin' || (user.role === 'Admin' && request.requestedBy.role !== 'Admin' && request.role !== 'Admin');
  const beginApproval = (request: AccountRequest) => { setSelected(request); setPassword(''); setDecisionError(''); };
  const decide = async (decision: 'Approved' | 'Rejected', request: AccountRequest, initialPassword?: string) => {
    setBusy(true); setDecisionError(''); setActionError('');
    try {
      await reviewAccountRequest(request.id, decision, request.version, initialPassword);
      setSelected(null); setPassword(''); setMessage(decision === 'Approved' ? `Account approved and created for ${request.firstName} ${request.lastName}.` : 'Account request rejected.');
      setReload(value => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : `The request could not be ${decision.toLowerCase()}.`;
      if (selected && decision === 'Approved') setDecisionError(text); else setActionError(text);
    } finally { setBusy(false); }
  };
  const approve = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (password.trim().length < 12 || new TextEncoder().encode(password).length > 1024) {
      setDecisionError('Use a password with at least 12 non-whitespace characters and at most 1,024 UTF-8 bytes.'); return;
    }
    void decide('Approved', selected, password);
  };
  const reject = (request: AccountRequest) => {
    if (window.confirm(`Reject the account request for ${request.firstName} ${request.lastName}?`)) void decide('Rejected', request);
  };
  const remove = async (request: AccountRequest) => {
    if (!canReview(request) || request.status !== 'Approved' || busy || !window.confirm(`Remove the approved request for ${request.firstName} ${request.lastName} from this list? Its audit history will be retained.`)) return;
    setBusy(true); setActionError(''); setMessage('');
    try { await deleteAccountRequest(request.id); setMessage('Approved request removed from the list.'); setReload(value => value + 1); }
    catch (error) { setActionError(error instanceof ApiError ? error.message : 'The approved request could not be removed.'); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Account Requests" description={reviewer ? 'Review proposed accounts before they are created.' : 'Request an account and track its approval status.'} />
    <div className="sl-admin-view sl-account-requests-page">
      {message && <p className="sl-inline-notice" role="status">{message}</p>}
      {actionError && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{actionError}</p>}
      {requester && <Card id="submit-account-request" title="Request an account">
        {user.role === 'Admin' && <p className="sl-supporting">Admin requests require Super Admin approval. The account will not be created until approved.</p>}
        <form className="sl-account-request-form" onSubmit={submit} noValidate>
          <label>First name<input className="sl-admin-input" maxLength={25} value={form.firstName} disabled={busy} aria-invalid={!!fieldErrors.firstName || undefined} onChange={event => setValue('firstName', event.target.value)} />{fieldErrors.firstName && <small className="sl-field-error">{fieldErrors.firstName}</small>}</label>
          <label>Last name<input className="sl-admin-input" maxLength={25} value={form.lastName} disabled={busy} aria-invalid={!!fieldErrors.lastName || undefined} onChange={event => setValue('lastName', event.target.value)} />{fieldErrors.lastName && <small className="sl-field-error">{fieldErrors.lastName}</small>}</label>
          <label>Email<input className="sl-admin-input" type="email" maxLength={254} placeholder="name@shelflife.com" value={form.email} disabled={busy} aria-invalid={!!fieldErrors.email || undefined} onChange={event => setValue('email', event.target.value)} />{fieldErrors.email && <small className="sl-field-error">{fieldErrors.email}</small>}</label>
          <label>Requested role<select className="sl-admin-input" value={form.role} disabled={busy} onChange={event => setValue('role', event.target.value as AccountRequestInput['role'])}>{(user.role === 'Admin' ? requestableRoles : ['Inventory Manager', 'Inventory Staff'] as const).map(role => <option key={role} value={role}>{role}</option>)}</select>{fieldErrors.role && <small className="sl-field-error">{fieldErrors.role}</small>}</label>
          <button type="submit" className="sl-button sl-button-primary" disabled={busy}><UserPlus size={16} aria-hidden="true" />{busy ? 'Submitting…' : 'Submit request'}</button>
        </form>
      </Card>}
      <Card id="account-request-list" title={reviewer ? 'Requests for approval' : 'Your requests'}>
        {loading ? <DataState kind="loading" title="Loading account requests" description="Retrieving request status." /> : loadError ? <DataState kind="error" title="Requests unavailable" description={loadError} action={<button className="sl-button" type="button" onClick={() => setReload(value => value + 1)}>Retry</button>} /> : !items.length ? <DataState kind="empty" title="No account requests" description={reviewer ? 'New account requests will appear here.' : 'Your submitted requests will appear here.'} /> :
          <div className="sl-table-scroll" role="region" aria-label="Account requests" tabIndex={0}><table className="sl-data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Requested by</th><th>Submitted</th><th>Status</th><th>Decision</th></tr></thead><tbody>
            {items.map(request => <tr key={request.id}><td>{request.firstName} {request.lastName}</td><td>{request.email}</td><td>{request.role}</td><td>{request.requestedBy.name} <span className="sl-supporting">({request.requestedBy.role})</span></td><td>{new Date(request.createdAt).toLocaleDateString()}</td><td><Status tone={request.status === 'Approved' ? 'success' : request.status === 'Rejected' ? 'critical' : 'attention'}>{request.status}</Status>{request.reviewedBy && <div className="sl-supporting">By {request.reviewedBy.name}</div>}</td><td>{request.status === 'Pending' && canReview(request) ? <div className="sl-row-actions"><button type="button" className="sl-button sl-button-primary" disabled={busy} onClick={() => beginApproval(request)}><Check size={15} aria-hidden="true" />Approve</button><button type="button" className="sl-button" disabled={busy} onClick={() => reject(request)}><X size={15} aria-hidden="true" />Reject</button></div> : request.status === 'Pending' && reviewer ? <span className="sl-supporting">Super Admin approval required</span> : request.status === 'Approved' && reviewer && canReview(request) ? <div className="sl-row-actions"><span className="sl-supporting">Account created</span><button type="button" className="sl-icon-button" title="Remove approved request from list" aria-label={`Delete approved request for ${request.firstName} ${request.lastName}`} disabled={busy} onClick={() => void remove(request)}><Trash2 size={16} aria-hidden="true" /></button></div> : request.accountId ? <span className="sl-supporting">Account created</span> : <span className="sl-supporting">—</span>}</td></tr>)}
          </tbody></table></div>}
      </Card>
    </div>
    <Dialog open={!!selected} title="Approve account request" onDismiss={() => { if (!busy) setSelected(null); }} busy={busy} actions={<><button type="button" className="sl-button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button><button type="submit" className="sl-button sl-button-primary" form="account-request-approval" disabled={busy}>{busy ? 'Creating account…' : 'Approve and create account'}</button></>}>
      {selected && <form id="account-request-approval" onSubmit={approve} className="sl-account-request-approval"><p>Create {selected.firstName} {selected.lastName} as <strong>{selected.role}</strong>. Set the initial password now; share it with the requester securely.</p>{decisionError && <p role="alert" className="sl-inline-notice sl-inline-notice-error">{decisionError}</p>}<label>Initial password<input className="sl-admin-input" type="password" autoComplete="new-password" minLength={12} maxLength={1024} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label></form>}
    </Dialog>
  </>;
}
