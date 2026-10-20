import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from '../../routing/navigation';
import { AuthRequestError, changePassword, completeEmailChange, emailChangeAvailability, requestEmailChange, updateProfile, type SessionUser } from '../../services/auth';
import { clearSession } from '../../services/session';
import { publishActionFeedback } from '../../services/actionFeedback';
import { Dialog } from './Dialog';
import { PageHeader } from './primitives';
import { useApplicationWorkspace } from './ApplicationWorkspace';

// The shared four-role profile reproduces the owner's approved reference layout. First and last
// name are separate authoritative fields. The Role row, the profile avatar and the profile-photo
// upload block stay absent: photo storage was removed from project scope, and identity initials are
// shown once, in the shell's topbar avatar, rather than repeated on this page. Email self-service is
// offered only to the roles the backend authorizes, when verified mail delivery is configured.
//
// The notification preferences block was removed from the profile. No notification model, endpoint,
// event producer, persistence or delivery exists in the backend, so this page must not imply a saved
// preference or a delivered alert; in-app operational alerts stay owned by their own modules.
type EditableField = 'firstName' | 'lastName';
const labels: Record<EditableField, string> = { firstName: 'First name', lastName: 'Last name' };
// Mirrors the server rule exactly, so the message a user sees matches the message a rejected
// request would produce.
const maxNameLength = 25;
function cleanName(value: string) { return value.trim().replace(/\s+/g, ' '); }

function NameRow({ field, value, disabled, onSaved }: {
  field: EditableField; value: string; disabled: boolean;
  onSaved: (user: SessionUser, message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);

  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const start = () => { setDraft(value === 'Unavailable' ? '' : value); setError(''); setEditing(true); };
  const cancel = () => { setEditing(false); setError(''); opener.current?.focus(); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const clean = cleanName(draft);
    if (!clean || clean.length > maxNameLength) { setError(`Enter 1-${maxNameLength} characters.`); return; }
    submitting.current = true; setSaving(true); setError('');
    try {
      const result = await updateProfile({ [field]: clean });
      setEditing(false);
      onSaved(result.user, result.message);
    } catch (failure) {
      const message = failure instanceof AuthRequestError ? failure.message : 'Unable to save your details right now. Please try again.';
      setError(message);
      publishActionFeedback({ kind: 'error', message });
    } finally { submitting.current = false; setSaving(false); }
  };

  return <div className="sl-profile-manager-row" data-editing={editing || undefined}>
    <dt>{labels[field]}</dt>
    {editing ? <dd>
      <form className="sl-profile-manager-form" noValidate aria-busy={saving} onSubmit={submit}>
        <label className="sl-sr-only" htmlFor={`sl-profile-manager-${field}`}>{labels[field]}</label>
        <input ref={input} id={`sl-profile-manager-${field}`} type="text" value={draft} disabled={saving}
          maxLength={25} autoComplete="off" aria-invalid={!!error}
          aria-describedby={error ? `sl-profile-manager-${field}-error` : undefined}
          onChange={event => { setDraft(event.target.value); setError(''); }} />
        <div className="sl-profile-manager-form-actions">
          <button type="submit" className="sl-button sl-button-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" className="sl-button" disabled={saving} onClick={cancel}>Cancel</button>
        </div>
      </form>
      {error && <p id={`sl-profile-manager-${field}-error`} role="alert" className="sl-field-error">{error}</p>}
    </dd> : <dd>
      <span className="sl-profile-manager-value">{value}</span>
      <button ref={opener} type="button" className="sl-button sl-text-action sl-profile-manager-edit" disabled={disabled}
        onClick={start} aria-label={`Edit ${labels[field].toLowerCase()}`}>Edit</button>
    </dd>}
  </div>;
}


type PasswordChangeProps = { open: boolean; onDismiss: () => void; returnFocus: RefObject<HTMLButtonElement | null> };

function ManagerPasswordChange({ open, onDismiss, returnFocus }: PasswordChangeProps) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // One error per field, so a message can never appear beneath the wrong input and aria-invalid
  // marks only the field that actually failed. formError carries a whole-form failure.
  const [currentError, setCurrentError] = useState('');
  const [nextError, setNextError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  // Each field toggles its own visibility, so revealing one password never reveals another.
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const submitting = useRef(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirmation(''); setCurrentError(''); setNextError(''); setConfirmError(''); setFormError(''); setDone(false); setShowCurrent(false); setShowNext(false); setShowConfirm(false); };
  const dismiss = () => { if (pending) return; reset(); onDismiss(); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    // Each field is validated on its own against the same policy the server enforces, so the
    // message that appears sits directly beneath the field it actually describes.
    let failed = false;
    let currentMessage = '';
    let nextMessage = '';
    let confirmMessage = '';
    if (!current) { currentMessage = 'Enter your current password.'; failed = true; }
    if (!next) { nextMessage = 'Enter a new password.'; failed = true; }
    else if (next.length < 12) { nextMessage = 'Use at least 12 characters for your new password.'; failed = true; }
    else if (new TextEncoder().encode(next).length > 1024) { nextMessage = 'Use a shorter password (at most 1,024 UTF-8 bytes).'; failed = true; }
    if (!confirmation) { confirmMessage = 'Confirm your new password.'; failed = true; }
    else if (next && next !== confirmation) { confirmMessage = 'The new password and its confirmation do not match.'; failed = true; }
    setCurrentError(currentMessage); setNextError(nextMessage); setConfirmError(confirmMessage); setFormError('');
    if (failed) return;
    submitting.current = true; setPending(true);
    try {
      await changePassword(current, next);
      publishActionFeedback({ kind: 'success', message: 'Password updated. Sign in again with your new password.' });
      // The server revokes every issued credential by version, so this session is already
      // ended server-side. Clearing the token keeps the client from presenting it again.
      clearSession();
      reset(); setDone(true);
    } catch (error) {
      // A backend rejection is shown beside the field it concerns; anything else is a form-level
      // failure. A rejected change never reads as a success.
      const rejected = error instanceof AuthRequestError && error.status === 400;
      const message = error instanceof AuthRequestError ? error.message : 'Unable to change your password right now. Please try again.';
      if (rejected && /current password/i.test(message)) setCurrentError(message);
      else if (rejected && /12 characters|shorter password/i.test(message)) setNextError(message);
      else setFormError(message);
      publishActionFeedback({ kind: 'error', message });
    } finally { submitting.current = false; setPending(false); }
  };

  // Cancel, Escape and the focus trap remain the only dismissal paths; the reference dialog has no
  // top-right close control, so showClose is off and every exit still restores focus to the opener.
  return <Dialog open={open} title="Change password" onDismiss={dismiss} returnFocus={returnFocus}
    busy={pending} showClose={false} closeLabel="Close change password" actions={done ? undefined : <>
      <button type="button" className="sl-button" disabled={pending} data-initial-focus onClick={dismiss}>Cancel</button>
      <button type="submit" form="sl-profile-manager-password-form" className="sl-button sl-button-primary" disabled={pending}>{pending ? 'Updating...' : 'Change password'}</button>
    </>}>
    {done
      ? <div className="sl-profile-manager-password-done">
        <p role="status">Password updated. Your other signed-in sessions have been ended.</p>
        <button type="button" className="sl-button sl-button-primary" onClick={() => router.replace('/ShelfLifeAILogin')}>Go to sign in</button>
      </div>
      : <form id="sl-profile-manager-password-form" noValidate className="sl-profile-manager-password-form" aria-busy={pending} onSubmit={submit}>
        <div className="sl-field">
          <label htmlFor="sl-profile-manager-current-password">Current password</label>
          <div className="sl-password-field">
            <input id="sl-profile-manager-current-password" type={showCurrent ? 'text' : 'password'} autoComplete="current-password" maxLength={128} disabled={pending}
              data-initial-focus value={current} aria-invalid={!!currentError}
              aria-describedby={currentError ? 'sl-profile-manager-current-password-error' : undefined}
              onChange={event => { setCurrent(event.target.value); setCurrentError(''); setFormError(''); }} />
            <button type="button" className="sl-password-toggle" disabled={pending}
              aria-label={showCurrent ? 'Hide current password' : 'Show current password'} aria-controls="sl-profile-manager-current-password"
              onClick={() => setShowCurrent(value => !value)}>
              {showCurrent ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          {currentError && <p id="sl-profile-manager-current-password-error" role="alert" className="sl-field-error">{currentError}</p>}
        </div>
        <div className="sl-field">
          <label htmlFor="sl-profile-manager-new-password">New password</label>
          <div className="sl-password-field">
            <input id="sl-profile-manager-new-password" type={showNext ? 'text' : 'password'} autoComplete="new-password" maxLength={128} disabled={pending}
              value={next} aria-invalid={!!nextError}
              aria-describedby={nextError ? 'sl-profile-manager-new-password-help sl-profile-manager-new-password-error' : 'sl-profile-manager-new-password-help'}
              onChange={event => { setNext(event.target.value); setNextError(''); setFormError(''); }} />
            <button type="button" className="sl-password-toggle" disabled={pending}
              aria-label={showNext ? 'Hide new password' : 'Show new password'} aria-controls="sl-profile-manager-new-password"
              onClick={() => setShowNext(value => !value)}>
              {showNext ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          <p id="sl-profile-manager-new-password-help" className="sl-supporting">Use at least 12 characters.</p>
          {nextError && <p id="sl-profile-manager-new-password-error" role="alert" className="sl-field-error">{nextError}</p>}
        </div>
        <div className="sl-field">
          <label htmlFor="sl-profile-manager-confirm-password">Confirm new password</label>
          <div className="sl-password-field">
            <input id="sl-profile-manager-confirm-password" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" maxLength={128} disabled={pending}
              value={confirmation} aria-invalid={!!confirmError}
              aria-describedby={confirmError ? 'sl-profile-manager-confirm-password-error' : undefined}
              onChange={event => { setConfirmation(event.target.value); setConfirmError(''); setFormError(''); }} />
            <button type="button" className="sl-password-toggle" disabled={pending}
              aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-controls="sl-profile-manager-confirm-password"
              onClick={() => setShowConfirm(value => !value)}>
              {showConfirm ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          {confirmError && <p id="sl-profile-manager-confirm-password-error" role="alert" className="sl-field-error">{confirmError}</p>}
        </div>
        {formError && <p id="sl-profile-manager-password-error" role="alert" className="sl-field-error">{formError}</p>}
      </form>}
  </Dialog>;
}

function EmailChange({ open, onDismiss, returnFocus }: PasswordChangeProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const reset = () => { setEmail(''); setPassword(''); setCode(''); setStep('request'); setError(''); };
  const dismiss = () => { if (!pending) { reset(); onDismiss(); } };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setPending(true);
    try {
      if (step === 'request') {
        const result = await requestEmailChange(email, password);
        publishActionFeedback({ kind: 'success', message: result.message });
        setPassword(''); setStep('verify');
      } else {
        const result = await completeEmailChange(code);
        publishActionFeedback({ kind: 'success', message: result.message });
        clearSession(); router.replace('/ShelfLifeAILogin');
      }
    } catch (failure) {
      const message = failure instanceof AuthRequestError ? failure.message : 'Unable to update your email right now.';
      setError(message);
      publishActionFeedback({ kind: 'error', message });
    } finally { setPending(false); }
  };
  return <Dialog open={open} title="Change email" onDismiss={dismiss} returnFocus={returnFocus} busy={pending} closeLabel="Close change email"
    actions={<><button type="button" className="sl-button" disabled={pending} data-initial-focus onClick={dismiss}>Cancel</button>
      <button type="submit" form="sl-profile-email-form" className="sl-button sl-button-primary" disabled={pending}>{pending ? 'Working...' : step === 'request' ? 'Send code' : 'Verify email'}</button></>}>
    <form id="sl-profile-email-form" className="sl-profile-manager-password-form" noValidate aria-busy={pending} onSubmit={submit}>
      {step === 'request' ? <>
        <div className="sl-field"><label htmlFor="sl-profile-new-email">New email</label><input id="sl-profile-new-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={pending} required
          placeholder="name@shelflife.com" onChange={event => { setEmail(event.target.value); setError(''); }} /></div>
        <div className="sl-field"><label htmlFor="sl-profile-email-password">Current password</label><input id="sl-profile-email-password" type="password" autoComplete="current-password" maxLength={128} value={password} disabled={pending} required
          onChange={event => { setPassword(event.target.value); setError(''); }} /></div>
      </> : <div className="sl-field"><label htmlFor="sl-profile-email-code">Verification code</label><input id="sl-profile-email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} disabled={pending} required
        aria-describedby="sl-profile-email-code-help" onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} />
        <p id="sl-profile-email-code-help" className="sl-supporting">Enter the six-digit code sent to {email}.</p></div>}
      {error && <p role="alert" className="sl-field-error">{error}</p>}
    </form>
  </Dialog>;
}

// Email self-service is limited by role. Only Super Admin and Admin may change their own sign-in
// address, and only when verified mail delivery is configured, so the dialog is never offered when
// the backend would refuse the request. Managers and Inventory Staff can see their address but
// change it through an administrator, which the row states plainly rather than hiding the control.
function EmailRow({ value, canEdit }: { value: string; canEdit: boolean }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { let live = true; emailChangeAvailability().then(result => { if (live) setAvailable(result.available); }).catch(() => {}); return () => { live = false; }; }, []);
  const editable = canEdit && available;
  return <><div className="sl-profile-manager-row"><dt>Email</dt>
    <dd><span className="sl-profile-manager-value">{value}</span>
      {!editable && <span className="sl-profile-manager-managed">{canEdit ? 'Verification unavailable' : 'Managed by your administrator'}</span>}</dd>
    {editable && <button ref={trigger} type="button" className="sl-button sl-text-action sl-profile-manager-edit" onClick={() => setOpen(true)}>Edit</button>}</div>
    <EmailChange open={open} onDismiss={() => setOpen(false)} returnFocus={trigger} /></>;
}

function SecurityRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return <div className="sl-profile-manager-row"><dt>{label}</dt><dd>{children}</dd>{action}</div>;
}

export function ManagerProfilePage() {
  const { user, refreshIdentity } = useApplicationWorkspace();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const passwordTrigger = useRef<HTMLButtonElement>(null);  // A saved name is shown immediately while the shell re-resolves the identity, so the page, the
  // avatar initials and the account menu never disagree during the round trip.
  const [saved, setSaved] = useState<SessionUser | null>(null);
  const current = saved ?? user;
  useEffect(() => {
    if (saved && user.firstName === saved.firstName && user.lastName === saved.lastName) setSaved(null);
  }, [user, saved]);
  // Only the roles the backend authorizes may start a self-service email change.
  const canEditEmail = current.role === 'Super Admin' || current.role === 'Admin';
  // Super Admin renders the shared presentation inside its own surface; every other role keeps
  // the approved profile exactly as it is.
  const surface = current.role === 'Super Admin' ? ' sl-superadmin-surface sl-superadmin-profile' : '';
  const name = (value?: string) => value && value.trim() ? value : 'Unavailable';
  const onSaved = (next: SessionUser, message: string) => { setSaved(next); publishActionFeedback({ kind: 'success', message }); refreshIdentity(); };

  return <>
    <PageHeader eyebrow="Account" title="My Profile" description="Keep your details and sign-in settings up to date." />
    <div className={`sl-admin-view sl-profile-page sl-profile-manager${surface}`}>
      <section className="sl-profile-card" aria-labelledby="sl-profile-manager-details">
        <header className="sl-profile-card-header"><h2 id="sl-profile-manager-details">Your details</h2></header>
        <dl className="sl-profile-manager-rows">
          <NameRow field="firstName" value={name(current.firstName)} onSaved={onSaved} disabled={false} />
          <NameRow field="lastName" value={name(current.lastName)} onSaved={onSaved} disabled={false} />
          <EmailRow value={name(current.email)} canEdit={canEditEmail} />
        </dl>
      </section>

      <section className="sl-profile-card" aria-labelledby="sl-profile-manager-security">
        <header className="sl-profile-card-header"><h2 id="sl-profile-manager-security">Sign-in &amp; security</h2></header>
        <dl className="sl-profile-manager-rows" data-layout="security">
          <SecurityRow label="Password"
            action={<button ref={passwordTrigger} type="button" className="sl-button sl-text-action sl-profile-manager-action" onClick={() => setPasswordOpen(true)}>
              Change password
            </button>}>
            <span className="sl-profile-manager-value sl-profile-manager-masked" aria-label="Password is set">••••••••••</span>
          </SecurityRow>
        </dl>
      </section>
    </div>
    <ManagerPasswordChange open={passwordOpen} onDismiss={() => setPasswordOpen(false)} returnFocus={passwordTrigger} />
  </>;
}
