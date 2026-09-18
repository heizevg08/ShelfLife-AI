import { Ban, Eye, EyeOff, Pencil, RotateCcw, Search, UserPlus, Activity } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { accountSummary, createAccount, getAccount, listAccounts, listAuditRecords, setAccountActive, updateAccount, type Account, type AuditRecord, type DashboardSummary, type Page } from '../../services/administration';
import { ApiError } from '../../services/apiClient';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { DataState, Pagination, Status, SummaryCards } from './primitives';

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

export function AccountsTable() {
  const { user } = useApplicationWorkspace();
  const superAdmin = user.role === 'Super Admin';
  const assignableRoles: ManagedRole[] = superAdmin ? ['Admin', 'Manager', 'Inventory Staff'] : ['Manager', 'Inventory Staff'];
  const [assignedRole, setAssignedRole] = useState<ManagedRole>(superAdmin ? 'Admin' : 'Manager');
  const [page, setPage] = useState(1), [sort, setSort] = useState('createdAt'), [refresh, setRefresh] = useState(0);
  const [directorySearch, setDirectorySearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<Page<AuditRecord> | null>(null);
  const [data, setData] = useState<Page<Account> | null>(null), [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<'create' | 'view' | 'edit' | 'lifecycle' | null>(null), [selected, setSelected] = useState<Account | null>(null);
  const [fields, setFields] = useState(blank), [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setLoadError(false);
    listAccounts(page, sort, sort === 'createdAt' ? 'desc' : 'asc', abort.signal)
      .then(value => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    return () => abort.abort();
  }, [page, sort, refresh]);

  useEffect(() => {
    if (!superAdmin) return;
    const abort = new AbortController();
    accountSummary(abort.signal).then(setSummary).catch(() => setSummary(null));
    return () => abort.abort();
  }, [superAdmin, refresh]);

  useEffect(() => {
    if (!superAdmin) return;
    const abort = new AbortController();
    listAuditRecords(1, 5, 'desc', {}, abort.signal).then(setRecentActivity).catch(() => setRecentActivity(null));
    return () => abort.abort();
  }, [superAdmin, refresh]);

  const mayManage = (account: Account) => account.id !== user.id && (superAdmin ? ['Admin', 'Manager', 'Inventory Staff'].includes(account.role) : user.role === 'Admin' && (account.role === 'Manager' || account.role === 'Inventory Staff'));
  const visibleAccounts = useMemo(() => {
    if (!data) return [];
    const query = directorySearch.trim().toLowerCase();
    const filtered = data.items.filter(account => {
      const matchesSearch = !query || [account.name, account.email, account.role, account.isActive ? 'active' : 'inactive'].some(value => value.toLowerCase().includes(query));
      const matchesRole = roleFilter === 'All Roles' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'All Statuses' || (statusFilter === 'Active' ? account.isActive : !account.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Keep the visible page deterministic even if the API/database collation differs by environment.
    const direction = sort === 'createdAt' ? -1 : 1;
    return filtered.sort((a, b) => {
      const left = sort === 'createdAt' ? new Date(a.createdAt).getTime() : String(a[sort as keyof Account] ?? '').toLowerCase();
      const right = sort === 'createdAt' ? new Date(b.createdAt).getTime() : String(b[sort as keyof Account] ?? '').toLowerCase();
      return left < right ? -1 * direction : left > right ? 1 * direction : 0;
    });
  }, [data, directorySearch, roleFilter, statusFilter, sort]);

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

  const roleCounts = summary?.roleCounts ?? {};
  const totalUsers = summary?.totalUsers ?? data?.total ?? 0;
  const activeUsers = summary?.activeUsers ?? 0;
  const inactiveUsers = summary?.inactiveUsers ?? 0;
  const activePercent = totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0;
  const inactivePercent = totalUsers ? Math.round((inactiveUsers / totalUsers) * 100) : 0;
  const roleDistribution = (['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const).map(role => ({
    role,
    count: roleCounts[role] ?? 0,
  }));
  const distributionTotal = roleDistribution.reduce((sum, item) => sum + item.count, 0);
  const distributionStops = roleDistribution.reduce<{ cursor: number; stops: string[] }>((state, item, index) => {
    const palette = ['#07543f', '#63c978', '#f7b83f', '#72b8ef'];
    const next = state.cursor + (distributionTotal ? (item.count / distributionTotal) * 100 : 25);
    state.stops.push(`${palette[index]} ${state.cursor}% ${next}%`);
    state.cursor = next;
    return state;
  }, { cursor: 0, stops: [] });
  const distributionBackground = distributionTotal
    ? `radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(${distributionStops.stops.join(',')})`
    : 'radial-gradient(circle at center,#ffffff 0 48%,transparent 49%),conic-gradient(#e9eef3 0 100%)';
  const auditActionLabel: Record<string, string> = {
    CREATE: 'Created a user account',
    UPDATE: 'Updated account details',
    DEACTIVATE: 'Deactivated an account',
    REACTIVATE: 'Reactivated an account',
  };

  return <>
    {superAdmin && <SummaryCards items={[
      { label: 'Total Users', value: summary ? totalUsers : '—', detail: summary ? 'System-wide accounts' : 'Awaiting account summary', tone: 'brand' },
      { label: 'Active Accounts', value: summary ? activeUsers : '—', detail: summary ? `▲ ${activePercent}% active` : 'Awaiting account summary', tone: 'success' },
      { label: 'Inactive Accounts', value: summary ? inactiveUsers : '—', detail: summary ? `${inactivePercent}% inactive` : 'Awaiting account summary', tone: 'critical' },
      { label: 'Roles', value: 4, detail: 'Super Admin, Admin, Manager, Inventory Staff', tone: 'attention' },
    ]} />}

    <div className={superAdmin ? 'sl-v56-main-grid' : undefined}>
      <section className={superAdmin ? 'sl-v56-directory' : undefined}>
        <div className="sl-v56-filter-row">
          <div className="sl-directory-search sl-v56-search" role="search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={directorySearch} placeholder="Search by name, email, or role…" aria-label="Search users"
              onChange={event => setDirectorySearch(event.target.value)} />
          </div>
          {superAdmin && <label className="sl-v56-filter">Role
            <select className="sl-admin-input" value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setPage(1); }}>
              <option>All Roles</option><option>Super Admin</option><option>Admin</option><option>Manager</option><option>Inventory Staff</option>
            </select>
          </label>}
          {superAdmin && <label className="sl-v56-filter">Status
            <select className="sl-admin-input" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}>
              <option>All Statuses</option><option>Active</option><option>Inactive</option>
            </select>
          </label>}
          {superAdmin && <button className="sl-button sl-v56-reset" onClick={() => {
            setDirectorySearch(''); setRoleFilter('All Roles'); setStatusFilter('All Statuses'); setPage(1);
          }}>Reset</button>}
          {superAdmin && <button className="sl-button sl-button-primary sl-v56-add-user" disabled={busy} onClick={() => {
            setMode('create'); setAssignedRole('Admin'); setFields(blank); setErrors({}); setTouched({}); setShowPassword(false); setMessage('');
          }}><UserPlus size={16} aria-hidden="true" /> Add User</button>}
        </div>

        {message && <p className="sl-section-note" role="status">{message}</p>}

        <div className="sl-v56-table-wrap" role="region" aria-label="User account directory" tabIndex={0}>
          <table className="sl-data-table sl-v56-table">
            <thead><tr>
              {superAdmin && <th scope="col">#</th>}
              <th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th>
              {superAdmin && <th scope="col">Last Login</th>}
              {superAdmin && <th scope="col">Created At</th>}
              <th scope="col">Actions</th>
            </tr></thead>
            <tbody>
              {loadError ? <tr><td colSpan={superAdmin ? 8 : 5} className="sl-empty-cell"><DataState kind="error" title="Accounts could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
              : !data ? <tr><td colSpan={superAdmin ? 8 : 5} className="sl-empty-cell"><DataState kind="loading" title="Loading accounts" description="" /></td></tr>
              : !visibleAccounts.length ? <tr><td colSpan={superAdmin ? 8 : 5} className="sl-empty-cell"><DataState kind="empty" title="No matching accounts" description="Try another search or filter." /></td></tr>
              : visibleAccounts.map((account, index) => <tr key={account.id}>
                {superAdmin && <td>{(data.page - 1) * data.pageSize + index + 1}</td>}
                <td className="sl-v56-name">{account.name}</td>
                <td>{account.email}</td>
                <td><span className="sl-v56-role-pill" data-role={account.role}>{account.role}</span></td>
                <td><Status tone={account.isActive ? 'success' : 'critical'}>{account.isActive ? 'Active' : 'Inactive'}</Status></td>
                {superAdmin && <td><span className="sl-v56-unavailable">—</span></td>}
                {superAdmin && <td>{new Date(account.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</td>}
                <td><div className="sl-row-actions sl-v56-actions">
                  <button className="sl-v56-more" disabled={busy} aria-label={`View actions for ${account.name}`} onClick={() => open(account, 'view')}>•••</button>
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} itemLabel="users" onPageChange={setPage} />}
      </section>

      {superAdmin && <aside className="sl-v56-side">
        <section className="sl-v56-side-card">
          <h2>User Distribution</h2>
          <div className="sl-v56-distribution">
            <div className="sl-v56-donut" style={{ background: distributionBackground }}>
              <strong>{summary ? totalUsers : '—'}</strong><span>Users</span>
            </div>
            <div className="sl-v56-legend">
              {roleDistribution.map(item => <div key={item.role}>
                <span className="sl-v56-dot" data-role={item.role} />
                <span>{item.role}</span><strong>{summary ? item.count : '—'}</strong>
              </div>)}
            </div>
          </div>
        </section>

        <section className="sl-v56-side-card">
          <h2>Account Status</h2>
          <div className="sl-v61-status">
            <div className="sl-v61-status-top"><span>Active</span><strong>{summary ? activeUsers : '—'}</strong></div>
            <div className="sl-v61-status-bottom">
              <div className="sl-v61-status-track"><span style={{ width: summary ? `${activePercent}%` : '0%' }} /></div>
              <small>{summary ? `${activePercent}%` : '—'}</small>
            </div>
          </div>
          <div className="sl-v61-status" data-kind="inactive">
            <div className="sl-v61-status-top"><span>Inactive</span><strong>{summary ? inactiveUsers : '—'}</strong></div>
            <div className="sl-v61-status-bottom">
              <div className="sl-v61-status-track"><span style={{ width: summary ? `${inactivePercent}%` : '0%' }} /></div>
              <small>{summary ? `${inactivePercent}%` : '—'}</small>
            </div>
          </div>
        </section>

        <section className="sl-v56-side-card sl-v56-activity">
          <div className="sl-v60-activity-head"><h2>Recent Account Activity</h2><a href="/SecurityActivity">View all <span aria-hidden="true">→</span></a></div>
          {!recentActivity ? <p className="sl-supporting">Loading activity…</p>
          : !recentActivity.items.length ? <div className="sl-v58-activity-empty"><span className="sl-v56-activity-icon"><Activity size={15} aria-hidden="true" /></span><div><strong>No account activity yet</strong><span>Recorded account changes will appear here.</span></div></div>
          : <ul>{recentActivity.items.map(record => <li key={record.id}>
              <span className="sl-v56-activity-icon"><Activity size={13} aria-hidden="true" /></span>
              <div><strong>{record.actor.name}</strong><span>{auditActionLabel[record.action] ?? record.action}</span>
              <time dateTime={record.timestamp}>{new Date(record.timestamp).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</time></div>
            </li>)}</ul>}
        </section>
      </aside>}
    </div>

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
