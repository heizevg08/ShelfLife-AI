import { Activity, Ban, CalendarDays, Clock3, Eye, EyeOff, FileText, Pencil, RefreshCw, Search, Trash2, User, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { accountSummary, dashboardSummary, createAccount, getAccount, listAccounts, setAccountActive, updateAccount, type Account, type DashboardSummary, type Page } from '../../services/administration';
import { ApiError } from '../../services/apiClient';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { APPLICATION_RECORD_PAGE_SIZES } from './ApplicationPatterns';
import { DataState, Pagination, Status, SummaryCards } from './primitives';
import { sessionInitials } from '../../services/auth';

const blank = { firstName: '', lastName: '', email: '', password: '' };
type ManagedRole = 'Admin' | 'Manager' | 'Inventory Staff';
const NAME_LIMIT = 25;
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/;
const PASSWORD_MAX_UTF8_BYTES = 1024;
const SUMMARY_AUTO_REFRESH_MS = 15000;
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
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [sort, setSort] = useState('createdAt'), [refresh, setRefresh] = useState(0);
  const [directorySearch, setDirectorySearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState(superAdmin ? 'Active' : 'All Statuses');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [data, setData] = useState<Page<Account> | null>(null), [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<'create' | 'view' | 'edit' | 'lifecycle' | null>(null), [selected, setSelected] = useState<Account | null>(null);
  const [fields, setFields] = useState(blank), [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    setLoadError(false);
    const timer = window.setTimeout(() => listAccounts(page, sort, sort === 'createdAt' ? 'desc' : 'asc', abort.signal, pageSize, superAdmin ? {} : {
      search: directorySearch.trim(),
      role: roleFilter === 'All Roles' ? undefined : roleFilter as Account['role'],
      status: statusFilter === 'All Statuses' ? undefined : statusFilter as 'Active' | 'Deactivated',
    })
      .then(value => { if (!abort.signal.aborted) setData(value); })
      .catch(() => { if (!abort.signal.aborted) setLoadError(true); }), 250);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [page, pageSize, sort, refresh, superAdmin, directorySearch, roleFilter, statusFilter]);

  useEffect(() => {
    const abort = new AbortController();
    (superAdmin ? dashboardSummary(abort.signal) : accountSummary(abort.signal)).then(setSummary).catch(() => setSummary(null));
    return () => abort.abort();
  }, [refresh, superAdmin]);

  // Keep the account summary current while this administrative workspace remains open.
  useEffect(() => {
    if (!superAdmin && user.role !== 'Admin') return;
    const interval = window.setInterval(() => setRefresh(value => value + 1), SUMMARY_AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [superAdmin, user.role]);

  const mayManage = (account: Account) => account.id !== user.id && (superAdmin ? ['Admin', 'Manager', 'Inventory Staff'].includes(account.role) : user.role === 'Admin' && (account.role === 'Manager' || account.role === 'Inventory Staff'));
  const visibleAccounts = useMemo(() => {
    if (!data) return [];
    const query = directorySearch.trim().toLowerCase();
    if (!superAdmin) return data.items;
    const filtered = data.items.filter(account => {
      const displayName = `${account.firstName} ${account.lastName}`.trim();
      const matchesSearch = !query || [displayName, account.email, account.role, account.isActive ? 'active' : superAdmin ? 'inactive' : 'deactivated'].some(value => value.toLowerCase().includes(query));
      const matchesRole = roleFilter === 'All Roles' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'All Statuses'
        || (statusFilter === 'Active' && account.isActive)
        || (statusFilter === 'Deactivated' && !account.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Keep the visible page deterministic even if the API/database collation differs by environment.
    const direction = sort === 'createdAt' ? -1 : 1;
    return filtered.sort((a, b) => {
      const left = sort === 'createdAt' ? new Date(a.createdAt).getTime() : String(a[sort as keyof Account] ?? '').toLowerCase();
      const right = sort === 'createdAt' ? new Date(b.createdAt).getTime() : String(b[sort as keyof Account] ?? '').toLowerCase();
      return left < right ? -1 * direction : left > right ? 1 * direction : 0;
    });
  }, [data, directorySearch, roleFilter, statusFilter, sort, superAdmin]);

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

  const totalUsers = summary?.totalUsers ?? data?.total ?? 0;
  const activeUsers = summary?.activeUsers ?? 0;
  const activePercent = totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0;
  return <>
    {!superAdmin && <section className="sl-sa-kpis sl-inventory-staff-kpis sl-admin-user-kpis" aria-label="Active user management summary">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Total Users</span><strong>{summary ? totalUsers.toLocaleString() : '—'}</strong><small>{summary ? 'Active authorized accounts' : 'Active account totals unavailable'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UserCheck aria-hidden="true" /></span><div><span>Admin</span><strong>{summary ? (summary.roleCounts?.Admin ?? 0).toLocaleString() : '—'}</strong><small>{summary ? 'Active Admin accounts' : 'Active account totals unavailable'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Managers</span><strong>{summary ? (summary.roleCounts?.Manager ?? 0).toLocaleString() : '—'}</strong><small>{summary ? 'Active Manager accounts' : 'Active account totals unavailable'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Inventory Staff</span><strong>{summary ? (summary.roleCounts?.['Inventory Staff'] ?? 0).toLocaleString() : '—'}</strong><small>{summary ? 'Active Inventory Staff accounts' : 'Active account totals unavailable'}</small></div></article>
    </section>}
    {superAdmin && <section className="sl-sa-kpis sl-inventory-staff-kpis" aria-label="User management summary">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Users aria-hidden="true" /></span><div><span>Total Users</span><strong>{summary ? totalUsers : '—'}</strong><small>{summary ? 'System-wide accounts' : 'Preview · data pending'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><UserCheck aria-hidden="true" /></span><div><span>Active Accounts</span><strong>{summary ? activeUsers : '—'}</strong><small>{summary ? `▲ ${activePercent}% active` : 'Preview · data pending'}</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3 aria-hidden="true" /></span><div><span>Idle Accounts</span><strong>—</strong><small>Session status data pending</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><Ban aria-hidden="true" /></span><div><span>Suspended Accounts</span><strong>—</strong><small>Session status data pending</small></div></article>
    </section>}

    <div className={superAdmin ? 'sl-v56-main-grid' : undefined}>
      <section className={superAdmin ? 'sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-user-accounts-table-card' : 'sl-application-records sl-user-accounts-table-card sl-admin-user-records'}>
        <header className={superAdmin ? 'sl-staff-usage-card-head sl-staff-usage-records-head' : 'sl-application-records-header'}><span className={superAdmin ? 'sl-staff-usage-head-icon' : 'sl-application-records-icon'}><FileText aria-hidden="true" /></span><h2>User Accounts</h2></header>
        <div className="sl-user-accounts-table-body">
        <div className={superAdmin ? 'sl-sa-ingredients-table-filters' : 'sl-application-records-filters'}>
        <div className={superAdmin ? 'sl-sa-ingredients-filter-card sl-user-accounts-filter-card' : 'sl-application-records-toolbar sl-user-accounts-filter-card'} data-layout={superAdmin ? undefined : 'users'}>
          <label className={superAdmin ? 'sl-sa-ingredients-search' : 'sl-application-records-search'}><span>Search users</span>
            <div role="search">
              <Search size={17} aria-hidden="true" />
              <input type="search" value={directorySearch} placeholder="Search by name, email, or role..." aria-label="Search users"
                onChange={event => { setDirectorySearch(event.target.value); setPage(1); }} />
            </div>
          </label>
          <label><span>Role</span>
            <select value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setPage(1); }}>
              <option>All Roles</option>{(superAdmin ? ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] : ['Admin', 'Manager', 'Inventory Staff']).map(role => <option key={role}>{role}</option>)}
            </select>
          </label>
          <label><span>Status</span>
            <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}>
              {superAdmin ? <><option>Active</option><option>Idle</option><option>Suspended</option><option>Logged Out</option></> : <><option>All Statuses</option><option>Active</option><option>Deactivated</option></>}
            </select>
          </label>
          {superAdmin ? <div className="sl-sa-ingredients-filter-actions">
            <button className="sl-button" onClick={() => {
              setDirectorySearch(''); setRoleFilter('All Roles'); setStatusFilter('Active'); setPage(1);
            }}>Reset</button>
            <button className="sl-button sl-button-primary" disabled={busy} onClick={() => {
              setMode('create'); setAssignedRole('Admin'); setFields(blank); setErrors({}); setTouched({}); setShowPassword(false); setMessage('');
            }}><UserPlus size={16} aria-hidden="true" /> Add User</button>
          </div> : <div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions">
            <button className="sl-button" onClick={() => {
              setDirectorySearch(''); setRoleFilter('All Roles'); setStatusFilter('All Statuses'); setPage(1);
            }}>Reset</button>
            <button className="sl-button sl-button-primary" disabled={busy} onClick={() => {
              setMode('create'); setAssignedRole('Manager'); setFields(blank); setErrors({}); setTouched({}); setShowPassword(false); setMessage('');
            }}><UserPlus size={16} aria-hidden="true" /> Add User</button>
          </div>}
        </div>
        </div>

        {message && <p className="sl-section-note" role="status">{message}</p>}

        <div className={superAdmin ? 'sl-sa-ingredients-table-scroll sl-staff-usage-table-shell' : 'sl-application-records-table-shell'} role="region" aria-label="User account directory" tabIndex={0}>
          <table className={superAdmin ? 'sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-user-accounts-table' : 'sl-application-records-table sl-user-accounts-table'} data-layout={superAdmin ? undefined : 'users'}>
            <thead><tr>
              <th scope="col">#</th>
              <th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th>
              <th scope="col">Last Login</th>
              {superAdmin && <th scope="col">Created At</th>}
              <th scope="col">Actions</th>
            </tr></thead>
            <tbody>
              {loadError ? <tr><td colSpan={superAdmin ? 8 : 7} className="sl-empty-cell"><DataState kind="error" title="Accounts could not be loaded" description="Check your connection and try again." action={<button className="sl-button" onClick={() => setRefresh(value => value + 1)}>Retry</button>} /></td></tr>
              : !data ? <tr><td colSpan={superAdmin ? 8 : 7} className="sl-empty-cell"><DataState kind="loading" title="Loading accounts" description="" /></td></tr>
              : !visibleAccounts.length ? <tr><td colSpan={superAdmin ? 8 : 7} className="sl-empty-cell"><DataState kind="empty" title="No matching accounts" description="Try another search or filter." /></td></tr>
              : visibleAccounts.map((account, index) => <tr key={account.id}>
                <td>{(data.page - 1) * data.pageSize + index + 1}</td>
                <td className={superAdmin ? 'sl-v56-name' : 'sl-v56-name sl-application-record-name'}>{superAdmin ? account.name : <span className="sl-emphasized-value">{account.name}</span>}</td>
                <td>{account.email}</td>
                <td><span className={superAdmin ? 'sl-v56-role-pill' : 'sl-application-role-pill'} data-role={account.role}>{account.role}</span></td>
                <td>{superAdmin ? <Status tone={account.isActive ? 'success' : 'critical'}>{account.isActive ? 'Active' : 'Inactive'}</Status> : <span className="sl-status sl-application-status" data-tone={account.isActive ? 'success' : 'critical'}>{account.isActive ? 'Active' : 'Deactivated'}</span>}</td>
                <td>{!superAdmin && account.lastLoginAt ? <time dateTime={account.lastLoginAt}>{new Date(account.lastLoginAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time> : <span className={superAdmin ? 'sl-v56-unavailable' : 'sl-application-unavailable'} title="No recorded login">—</span>}</td>
                {superAdmin && <td>{new Date(account.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</td>}
                <td><div className="sl-staff-waste-row-actions">
                  {superAdmin ? <>
                    <button type="button" className="sl-icon-button" disabled={busy} aria-label={`View ${account.name}`} title="View" onClick={() => open(account, 'view')}><Eye size={16} aria-hidden="true" /></button>
                    <button type="button" className="sl-icon-button" disabled={busy} aria-label={`Edit ${account.name}`} title="Edit" onClick={() => open(account, 'edit')}><Pencil size={16} aria-hidden="true" /></button>
                    <button type="button" className="sl-icon-button sl-staff-waste-delete sl-staff-usage-delete-action" disabled={busy} aria-label={`${account.isActive ? 'Deactivate' : 'Reactivate'} ${account.name}`} title={account.isActive ? 'Deactivate' : 'Reactivate'} onClick={() => open(account, 'lifecycle')}><Trash2 size={16} aria-hidden="true" /></button>
                  </> : <>
                    <button type="button" className="sl-icon-button sl-account-action-view" disabled={busy} aria-label={`View ${account.name}`} title="View" onClick={() => open(account, 'view')}><Eye size={16} aria-hidden="true" /></button>
                    <button type="button" className={`sl-icon-button ${account.isActive ? 'sl-account-action-deactivate' : 'sl-account-action-reactivate'}`} disabled={busy || !mayManage(account)} aria-label={`${account.isActive ? 'Deactivate' : 'Reactivate'} ${account.name}`} title={account.isActive ? 'Deactivate' : 'Reactivate'} onClick={() => open(account, 'lifecycle')}>{account.isActive ? <UserX size={16} aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}</button>
                  </>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className={superAdmin ? 'sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer' : 'sl-application-records-footer'}><label><span>Rows per page</span><select value={pageSize} aria-label="Rows per page" onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{APPLICATION_RECORD_PAGE_SIZES.map(value => <option key={value} value={value}>{value}</option>)}</select></label><Pagination compact page={data?.page ?? page} pageSize={data?.pageSize ?? pageSize} total={data?.total ?? 0} itemLabel="users" onPageChange={setPage} /></div>
        </div>
      </section>

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
        <div className="sl-dialog-form-actions"><button className="sl-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className={`sl-button sl-button-primary ${mode === 'edit' ? 'sl-save-changes-ui' : ''}`} disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Create account' : 'Save changes'}</button></div>
      </form>
    </Dialog>

    <Dialog open={mode === 'view'} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><User size={20} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Account Details</span><small>View account information and status.</small></span></span>} onDismiss={close} className="sl-add-user-dialog sl-account-reference-dialog sl-account-details-dialog" actions={selected && mayManage(selected) ? <><button className="sl-button" type="button" disabled={busy} onClick={() => void open(selected, 'edit')}><Pencil size={16} aria-hidden="true" />Edit account</button><button className={`sl-button ${selected.isActive ? 'sl-button-logout' : 'sl-button-primary'}`} type="button" disabled={busy} onClick={() => setMode('lifecycle')}>{selected.isActive ? <UserX size={16} aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}{selected.isActive ? 'Deactivate account' : 'Reactivate account'}</button></> : undefined}>
      {selected && <><section className="sl-account-details-identity" aria-labelledby="sl-account-details-name"><span className="sl-avatar sl-account-details-avatar" aria-hidden="true">{sessionInitials(selected)}</span><div><div className="sl-account-details-name-row"><h3 id="sl-account-details-name">{selected.name}</h3><span className="sl-application-role-pill sl-account-details-role" data-role={selected.role}>{selected.role}</span></div><p>{selected.email}</p></div></section><section className="sl-account-details-information" aria-labelledby="sl-account-information-title"><h3 id="sl-account-information-title">Account information</h3><dl className="sl-account-details-grid"><div><span className="sl-account-details-field-icon" aria-hidden="true"><Activity /></span><div><dt>Status</dt><dd><Status tone={selected.isActive ? 'success' : 'critical'}>{selected.isActive ? 'Active' : 'Deactivated'}</Status></dd></div></div><div><span className="sl-account-details-field-icon" aria-hidden="true"><Clock3 /></span><div><dt>Last Login</dt><dd>{selected.lastLoginAt ? <time dateTime={selected.lastLoginAt}>{new Date(selected.lastLoginAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time> : '—'}</dd></div></div><div><span className="sl-account-details-field-icon" aria-hidden="true"><CalendarDays /></span><div><dt>Created</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></div></div><div><span className="sl-account-details-field-icon" aria-hidden="true"><RefreshCw /></span><div><dt>Last Updated</dt><dd><time dateTime={selected.updatedAt}>{new Date(selected.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></div></div></dl></section></>}
    </Dialog>
    <Dialog open={mode === 'lifecycle'} showClose={false} className={`sl-logout-dialog sl-account-lifecycle-dialog${selected?.isActive ? ' is-destructive' : ' is-positive'}`} title={<><span className="sl-logout-icon" aria-hidden="true">{selected?.isActive ? <UserX size={20} /> : <UserCheck size={20} />}</span><span>{selected?.isActive ? 'Deactivate account?' : 'Reactivate account?'}</span></>} onDismiss={close} busy={busy} actions={<><button className="sl-button sl-logout-stay" data-initial-focus disabled={busy} onClick={close}>Cancel</button><button className={`sl-button ${selected?.isActive ? 'sl-button-logout' : 'sl-button-primary'}`} disabled={busy} onClick={lifecycle}>{busy ? 'Saving…' : selected?.isActive ? 'Deactivate account' : 'Reactivate account'}</button></>}>
      <p className="sl-description">{selected?.isActive ? 'This account will lose access to ShelfLife AI. Historical records will be preserved.' : 'This account will be able to sign in to ShelfLife AI again.'}</p><p className="sl-supporting">{selected?.email}</p>{errors.form && <p role="alert" className="sl-admin-error">{errors.form}</p>}
    </Dialog>
  </>;
}
