import { Ban, Eye, EyeOff, Pencil, RotateCcw, Search, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createAccount, getAccount, listAccounts, setAccountActive, updateAccount, type Account, type Page } from '../../services/administration';
import { ApiError } from '../../services/apiClient';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { DataState, Status } from './primitives';

const blank = { firstName: '', lastName: '', email: '', password: '' };
type ManagedRole = 'Admin' | 'Manager' | 'Inventory Staff';
const NAME_LIMIT = 25;
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/;
const PASSWORD_MAX_UTF8_BYTES = 1024;
const REQUIRED_ERROR = 'This field is required.';

function validShelfLifeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) && !email.startsWith('.') && !email.includes('..') && !email.includes('.@');
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length;
}
const AUTO_REFRESH_MS = 15000;

export function AccountsTable() {
  const { user } = useApplicationWorkspace();
  const superAdmin = user.role === 'Super Admin';
  const assignableRoles: ManagedRole[] = superAdmin ? ['Admin', 'Manager', 'Inventory Staff'] : ['Manager', 'Inventory Staff'];
  const [assignedRole, setAssignedRole] = useState<ManagedRole>(superAdmin ? 'Admin' : 'Manager');
  const [page, setPage] = useState(1), [sort, setSort] = useState('createdAt'), [refresh, setRefresh] = useState(0);
  const [directorySearch, setDirectorySearch] = useState('');
  const [data, setData] = useState<Page<Account> | null>(null), [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<'create' | 'view' | 'edit' | 'lifecycle' | null>(null), [selected, setSelected] = useState<Account | null>(null);
  const [fields, setFields] = useState(blank), [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setLoadError(false);
    listAccounts(page, sort, sort === 'createdAt' ? 'desc' : 'asc', abort.signal)
      .then(value => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    return () => abort.abort();
  }, [page, sort, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const mayManage = (account: Account) => account.id !== user.id && (superAdmin ? ['Admin', 'Manager', 'Inventory Staff'].includes(account.role) : user.role === 'Admin' && (account.role === 'Manager' || account.role === 'Inventory Staff'));
  const visibleAccounts = useMemo(() => {
    if (!data) return [];
    const query = directorySearch.trim().toLowerCase();
    const filtered = query
      ? data.items.filter(account => [account.name, account.email, account.role, account.isActive ? 'active' : 'inactive'].some(value => value.toLowerCase().includes(query)))
      : [...data.items];

    // Keep the visible page deterministic even if the API/database collation differs by environment.
    const direction = sort === 'createdAt' ? -1 : 1;
    return filtered.sort((a, b) => {
      const left = sort === 'createdAt' ? new Date(a.createdAt).getTime() : String(a[sort as keyof Account] ?? '').toLowerCase();
      const right = sort === 'createdAt' ? new Date(b.createdAt).getTime() : String(b[sort as keyof Account] ?? '').toLowerCase();
      return left < right ? -1 * direction : left > right ? 1 * direction : 0;
    });
  }, [data, directorySearch, sort]);

  async function open(account: Account, next: 'view' | 'edit' | 'lifecycle') {
    setBusy(true); setMessage(''); setErrors({});
    try {
      const result = await getAccount(account.id);
      setSelected(result.user);
      setAssignedRole(result.user.role as ManagedRole);
      setFields({ firstName: result.user.firstName, lastName: result.user.lastName, email: result.user.email, password: '' });
      setTouched({});
      setMode(next);
    } catch {
      setMessage('The account could not be loaded. Try again.');
    } finally {
      setBusy(false);
    }
  }


  function validateField(key: 'firstName' | 'lastName' | 'email' | 'password', value: string) {
    if (key === 'firstName' || key === 'lastName') {
      const trimmed = value.trim();
      if (!trimmed) return REQUIRED_ERROR;
      return trimmed.length > NAME_LIMIT ? `Enter 1–${NAME_LIMIT} characters.` : '';
    }
    if (!value.trim()) return REQUIRED_ERROR;
    if (key === 'email') return !validShelfLifeEmail(value) ? 'Enter a valid shelflife.com email.' : '';
    if (value.length < 12) return 'Use at least 12 characters.';
    return utf8Length(value) > PASSWORD_MAX_UTF8_BYTES ? 'Use a shorter password (at most 1,024 UTF-8 bytes).' : '';
  }

  function close() {
    if (!busy) {
      setMode(null);
      setSelected(null);
      setFields(blank);
      setErrors({});
      setTouched({});
      setShowPassword(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    const requiredFields = ['firstName', 'lastName', 'email', ...(mode === 'create' ? ['password'] as const : [])] as const;
    for (const key of requiredFields) {
      const error = validateField(key, fields[key]);
      if (error) next[key] = error;
    }
    if (!assignableRoles.includes(assignedRole)) next.role = 'Select a role.';
    if (Object.keys(next).length) {
      setTouched(previous => ({ ...previous, ...Object.fromEntries(Object.keys(next).map(key => [key, true])) }));
      setErrors({ ...next, form: 'Complete the required account details before continuing.' });
      const firstInvalidField = requiredFields.find(key => next[key]);
      if (firstInvalidField) document.getElementById(`admin-${firstInvalidField}`)?.focus();
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      const input = { firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), email: fields.email.trim().toLowerCase(), role: assignedRole };
      if (mode === 'create') await createAccount({ ...input, password: fields.password });
      else await updateAccount(selected!.id, input);
      setMessage(mode === 'create' ? 'Account created.' : 'Account updated.');
      setMode(null); setFields(blank); setSelected(null); setShowPassword(false); setRefresh(value => value + 1);
    } catch (error) {
      const details = error instanceof ApiError
        ? Object.fromEntries(error.details.map(item => [item.field, item.field === 'password' ? (item.message || 'Use at least 12 characters.') : item.message]))
        : {};
      setErrors({ ...details, form: error instanceof ApiError ? error.message : 'The result could not be confirmed. The directory will refresh automatically.' });
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle() {
    if (!selected || busy) return;
    setBusy(true); setErrors({});
    try {
      await setAccountActive(selected.id, !selected.isActive);
      setMessage(selected.isActive ? 'Account deactivated.' : 'Account reactivated.');
      setMode(null); setSelected(null); setRefresh(value => value + 1);
    } catch {
      setErrors({ form: 'The account change could not be confirmed. The directory will refresh automatically.' });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="sl-table-toolbar sl-account-toolbar sl-user-directory-toolbar">
      <div className="sl-directory-search" role="search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={directorySearch}
          placeholder="Search users"
          aria-label="Search user accounts on this page"
          onChange={event => setDirectorySearch(event.target.value)}
        />
      </div>
      <div className="sl-account-toolbar-actions">
        <label className="sl-supporting">Sort by
          <select className="sl-admin-input" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
            <option value="createdAt">Newest</option><option value="email">Email</option><option value="lastName">Last name</option><option value="role">Role</option>
          </select>
        </label>
        <button className="sl-button sl-button-primary" disabled={busy} onClick={() => { setMode('create'); setAssignedRole(superAdmin ? 'Admin' : 'Manager'); setFields(blank); setErrors({}); setTouched({}); setShowPassword(false); setMessage(''); }}>{'+ Add User'}</button>
      </div>
    </div>
    {message && <p className="sl-section-note" role="status">{message}</p>}
    <div className="sl-table-scroll" role="region" aria-label="User account directory" tabIndex={0}>
      <table className="sl-data-table"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
        {loadError ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="error" title="Accounts could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
        : !data ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="loading" title="Loading accounts" description="" /></td></tr>
        : !data.items.length ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="empty" title="No accounts on this page" description="Create an authorized account or return to the previous page." /></td></tr>
        : !visibleAccounts.length ? <tr><td colSpan={5} className="sl-empty-cell"><DataState kind="empty" title="No matching accounts" description="Try another search term." /></td></tr>
        : visibleAccounts.map(account => <tr key={account.id}>
          <td>{account.name}</td><td>{account.email}</td><td>{account.role}</td><td><Status tone={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Inactive'}</Status></td>
          <td><div className="sl-row-actions sl-account-actions"><button className="sl-button sl-account-action sl-account-action-view" disabled={busy} aria-label={`View ${account.name}`} onClick={() => open(account, 'view')}><Eye size={15} aria-hidden="true" />View</button>{mayManage(account) && <><button className="sl-button sl-account-action sl-account-action-edit" disabled={busy} aria-label={`Edit ${account.name}`} onClick={() => open(account, 'edit')}><Pencil size={15} aria-hidden="true" />Edit</button><button className={`sl-button sl-account-action ${account.isActive ? 'sl-account-action-deactivate' : 'sl-account-action-reactivate'}`} disabled={busy} aria-label={`${account.isActive ? 'Deactivate' : 'Reactivate'} ${account.name}`} onClick={() => open(account, 'lifecycle')}>{account.isActive ? <Ban size={15} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}{account.isActive ? 'Deactivate' : 'Reactivate'}</button></>}</div></td>
        </tr>)}
      </tbody></table>
    </div>
    {data && <div className="sl-table-toolbar sl-pagination"><span className="sl-supporting">{data.total} {data.total === 1 ? 'account' : 'accounts'} · Page {page}</span><div className="sl-row-actions"><button className="sl-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="sl-button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}

    <Dialog
      open={mode === 'create' || mode === 'edit'}
      title={mode === 'create'
        ? <span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><UserPlus size={21} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Add User Account</span><small>Create a new account and assign their role.</small></span></span>
        : mode === 'edit'
          ? <span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Pencil size={20} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Edit User Account</span><small>Update account details and assigned role.</small></span></span>
          : 'Create account'}
      onDismiss={close}
      busy={busy}
      className={mode === 'create' || mode === 'edit' ? 'sl-add-user-dialog sl-account-reference-dialog' : ''}
    >
      <form className="sl-admin-form sl-account-form" onSubmit={save} noValidate>
        <div className="sl-form-grid">
          {(['firstName', 'lastName', 'email', ...(mode === 'create' ? ['password'] as const : [])] as const).map(key => <div key={key} className={`sl-account-field${key === 'email' || key === 'password' ? ' sl-form-span-2' : ''}`}>
            <label htmlFor={`admin-${key}`}>{({ firstName: 'First name', lastName: 'Last name', email: 'Email', password: 'Temporary Password' })[key]}</label>
            <div className={key === 'password' ? 'sl-password-field' : undefined}>
              <input
                className="sl-admin-input"
                id={`admin-${key}`}
                type={key === 'password' ? (showPassword ? 'text' : 'password') : key === 'email' ? 'email' : 'text'}
                autoComplete={key === 'password' ? 'new-password' : 'off'}
                disabled={busy}
                value={fields[key]}
                maxLength={key === 'firstName' || key === 'lastName' ? NAME_LIMIT : undefined}
                aria-invalid={touched[key] && !!errors[key] ? true : undefined}
                aria-describedby={[touched[key] && errors[key] ? `admin-${key}-error` : '', key === 'password' ? 'admin-password-help' : ''].filter(Boolean).join(' ') || undefined}
                                onBlur={() => { setTouched(previous => ({ ...previous, [key]: true })); setErrors(previous => ({ ...previous, [key]: validateField(key, fields[key]) })); }}
                onChange={event => { const value = event.target.value; setFields({ ...fields, [key]: value }); setTouched(previous => ({ ...previous, [key]: true })); setErrors(previous => ({ ...previous, [key]: validateField(key, value), form: '' })); }}
              />
              {key === 'password' && <button className="sl-password-toggle" type="button" disabled={busy} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="admin-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>}
            </div>
            {touched[key] && errors[key] && <p id={`admin-${key}-error`} className="sl-admin-error">{errors[key]}</p>}
            {key === 'password' && <p id="admin-password-help" className="sl-password-help">Share this with the user — they can change it after signing in.</p>}
          </div>)}
          <fieldset className="sl-form-span-2 sl-role-picker" aria-invalid={touched.role && !!errors.role ? true : undefined} aria-describedby={touched.role && errors.role ? 'admin-role-error' : undefined}><legend>Role</legend>{assignableRoles.map(role => <label key={role} className="sl-role-option" data-selected={assignedRole === role}>
            <input type="radio" name="admin-role" value={role} checked={assignedRole === role} disabled={busy} onChange={() => { setAssignedRole(role); setTouched(previous => ({ ...previous, role: true })); setErrors(previous => ({ ...previous, role: '', form: '' })); }} />
            <span>{role}</span>
          </label>)}{touched.role && errors.role && <p id="admin-role-error" className="sl-admin-error">{errors.role}</p>}</fieldset>
        </div>
        {errors.form && <p role="alert" className="sl-admin-error">{errors.form}</p>}
        <div className="sl-dialog-form-actions"><button className="sl-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="sl-button sl-button-primary" disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Create account' : 'Save changes'}</button></div>
      </form>
    </Dialog>

    <Dialog open={mode === 'view'} title="Account details" onDismiss={close}>
      {selected && <dl className="sl-identity-details">{[['Name', selected.name], ['Email', selected.email], ['Role', selected.role], ['Status', selected.isActive ? 'Active' : 'Inactive'], ['Created', new Date(selected.createdAt).toLocaleString(undefined, { hour12: true })]].map(([label, value]) => <div key={label}><dt className="sl-supporting">{label}</dt><dd>{value}</dd></div>)}</dl>}
    </Dialog>
    <Dialog open={mode === 'lifecycle'} title={`${selected?.isActive ? 'Deactivate' : 'Reactivate'} account?`} onDismiss={close} busy={busy} actions={<><button className="sl-button" data-initial-focus disabled={busy} onClick={close}>Cancel</button><button className="sl-button sl-button-primary" disabled={busy} onClick={lifecycle}>{busy ? 'Saving…' : selected?.isActive ? 'Deactivate account' : 'Reactivate account'}</button></>}>
      <p>{selected?.isActive ? 'This account will lose access to ShelfLife AI. Historical records will be preserved.' : 'This account will be able to sign in to ShelfLife AI again.'}</p><p className="sl-supporting">{selected?.email}</p>{errors.form && <p role="alert" className="sl-admin-error">{errors.form}</p>}
    </Dialog>
  </>;
}
