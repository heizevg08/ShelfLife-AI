import { DataState, Status } from './primitives';
import { useEffect, useRef, useState } from 'react';
import { completePasswordReset, recoveryAvailability, requestPasswordReset } from '../../services/auth';

export function PasswordRecovery({ token }: { token?: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const submitting = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    if (!token) recoveryAvailability().then(value => { if (active) setAvailable(value.available); })
      .catch(() => { if (active) setError('Unable to check password recovery. Close this dialog and try again.'); });
    return () => { active = false; };
  }, [token]);
  if (!token && error && available === null) return <p role="alert" className="sl-field-error">{error}</p>;
  if (!token && available === null) return <p role="status">Checking password recovery...</p>;
  if (!token && !available) return <section className="sl-recovery-unavailable"><Status tone="neutral">Setup required</Status><DataState title="Email recovery is not available yet" description="Password recovery needs an email delivery service before it can send a reset link. No reset request has been sent. You can close this dialog and return to login." /></section>;
  if (complete) return <p role="status">Password updated. Close this dialog and log in with your new password.</p>;
  return <form noValidate className="sl-recovery-form" aria-busy={pending} onSubmit={async event => {
    event.preventDefault();
    if (submitting.current) return;
    const address = email.trim().toLowerCase();
    let validationError = '';
    if (token) {
      // Match the server's limits without trimming or changing password bytes.
      if (!password) validationError = 'Enter a new password.';
      else if (password.length < 12) validationError = 'Use at least 12 characters for your new password.';
      else if (new TextEncoder().encode(password).length > 1024) validationError = 'Use a shorter password (at most 1,024 UTF-8 bytes).';
    } else if (!address) validationError = 'Enter your email address.';
    else if (address.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/.test(address)
      || address.startsWith('.') || address.includes('..') || address.includes('.@')) {
      validationError = 'Enter a valid @shelflife.com email address.';
    }
    setFieldError(validationError); setError(''); setMessage('');
    if (validationError) {
      // Inline feedback and field focus replace browser validation bubbles.
      field.current?.focus();
      return;
    }
    submitting.current = true; setPending(true); setError(''); setMessage('');
    try {
      if (token) { await completePasswordReset(token, password); setPassword(''); setComplete(true); }
      else { const result = await requestPasswordReset(address); setMessage(result.message); }
    } catch { setError(token ? 'Unable to reset your password. The link may be invalid or expired, or the service unavailable.' : 'Unable to request recovery. Please try again later.'); }
    finally { submitting.current = false; setPending(false); }
  }}>
    {token ? <div className="sl-field"><label htmlFor="sl-new-password">New password</label>
      <input ref={field} id="sl-new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => { setPassword(event.target.value); setFieldError(''); setError(''); setMessage(''); }} disabled={pending} aria-invalid={!!fieldError} aria-describedby={`sl-reset-help sl-reset-feedback${fieldError ? ' sl-recovery-field-error' : ''}`} />
      <p id="sl-reset-help" className="sl-supporting">Use at least 12 characters.</p></div>
      : <div className="sl-field"><label htmlFor="sl-recovery-email">Email</label><input ref={field} id="sl-recovery-email" type="email" autoComplete="email" required value={email} onChange={event => { setEmail(event.target.value); setFieldError(''); setError(''); setMessage(''); }} disabled={pending} aria-invalid={!!fieldError} aria-describedby={`sl-reset-feedback${fieldError ? ' sl-recovery-field-error' : ''}`} /></div>}
    {fieldError && <p id="sl-recovery-field-error" role="alert" className="sl-field-error">{fieldError}</p>}
    <div id="sl-reset-feedback">{error && <p role="alert" className="sl-field-error">{error}</p>}{message && <p role="status">{message}</p>}</div>
    <button className="sl-button sl-button-primary" disabled={pending}>{pending ? 'Please wait...' : token ? 'Reset password' : 'Request recovery'}</button>
  </form>;
}
