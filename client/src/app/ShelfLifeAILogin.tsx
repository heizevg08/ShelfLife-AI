import { useRouter } from '../routing/navigation';
import { Eye, EyeOff, FileText, Info, LoaderCircle, LogIn, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Brand } from '../components/application/Brand';
import { Dialog } from '../components/application/Dialog';
import { PasswordRecovery } from '../components/application/PasswordRecovery';
import { TermsPolicyContent } from './Terms';
import { AuthRequestError, changePassword, login } from '../services/auth';
import { clearSession } from '../services/session';
import '../styles/application.css';

interface ValidationErrors { email?: string; password?: string; auth?: string }

function FirstLoginTermsPage({
  reachedBottom, accepted, onReachBottom, onAcceptedChange, onBack, onContinue,
}: {
  reachedBottom: boolean; accepted: boolean; onReachBottom: () => void; onAcceptedChange: (value: boolean) => void;
  onBack: () => void; onContinue: () => void;
}) {
  return <div className="sl-app sl-first-login-terms-page">
    <header className="sl-first-login-terms-header"><Brand login /><button type="button" onClick={onBack}>Back to password setup</button></header>
    <main className="sl-first-login-terms-main">
      <div className="sl-terms-eyebrow">ACCOUNT SETUP · STEP 1 OF 2</div>
      <h1>Terms and Privacy Policy</h1>
      <p className="sl-first-login-terms-intro">Read the full policy below. You can accept it after you reach the end, then return to set your new password.</p>
      <div className="sl-first-login-policy-scroll sl-first-login-policy-full" role="region" aria-label="Terms of Service and Privacy Policy. Scroll to the bottom to enable acceptance." tabIndex={0}
        onScroll={event => { const panel = event.currentTarget; if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4) onReachBottom(); }}>
        <TermsPolicyContent />
      </div>
      <label className={`sl-first-login-policy-accept${reachedBottom ? ' is-enabled' : ''}`}>
        <input type="checkbox" checked={accepted} disabled={!reachedBottom} onChange={event => onAcceptedChange(event.target.checked)} />
        <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
      </label>
      {!reachedBottom && <p className="sl-first-login-policy-hint">Scroll to the bottom of the policy to enable the agreement.</p>}
      <div className="sl-first-login-terms-actions">
        <button type="button" className="sl-first-login-terms-secondary" onClick={onBack}>Back</button>
        <button type="button" className="sl-button sl-button-primary" disabled={!accepted} onClick={onContinue}>Agree and return to password setup</button>
      </div>
    </main>
  </div>;
}

export default function ShelfLifeLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const submitting = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryButton = useRef<HTMLButtonElement>(null);
  const [resetToken, setResetToken] = useState<string>();
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [firstLogin, setFirstLogin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const newPasswordInput = useRef<HTMLInputElement>(null);
  const confirmPasswordInput = useRef<HTMLInputElement>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [termsReached, setTermsReached] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const [showFirstLoginTerms, setShowFirstLoginTerms] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const newPasswordError = newPasswordTouched && newPassword.length < 12
    ? newPassword ? 'Use at least 12 characters.' : 'Enter a new password.'
    : undefined;
  const confirmPasswordError = confirmPasswordTouched
    ? !confirmPassword ? 'Confirm your new password.' : newPassword !== confirmPassword ? 'The new passwords do not match.' : undefined
    : undefined;
  useEffect(() => { if (errors.auth) errorSummary.current?.focus(); }, [errors.auth]);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('reset');
    if (token) {
      // Keep the token only in component state while the reset form is open.
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
      setResetToken(token); setRecoveryOpen(true);
    }
  }, []);
  useEffect(() => {
    // After initialization, clear route state so URL synchronization cannot restore the fragment.
    if (resetToken) router.clearHash();
  }, [router, resetToken]);

  const validateForm = () => {
    const next: ValidationErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (next.email) emailInput.current?.focus();
    else if (next.password) passwordInput.current?.focus();
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter and button activation share one request; the ref also blocks same-tick repeats.
    if (submitting.current || !validateForm()) return;
    submitting.current = true;
    setIsLoading(true);
    setErrors({});
    try {
      const user = await login(email.trim().toLowerCase(), password, rememberMe);
      if (user.mustChangePassword) {
        setTemporaryPassword(password);
        setFirstLogin(true);
        setRememberMe(false);
        setPassword('');
        return;
      }
      switch (user.role) {
        case 'Super Admin': router.replace('/SuperAdminDashboard'); break;
        case 'Admin': router.replace('/AdminDashboard'); break;
        case 'Inventory Staff': router.replace('/InventoryStaffDashboard'); break;
        case 'Manager': router.replace('/ManagerDashboard'); break;
        default:
          clearSession();
          setErrors({ auth: 'Your account cannot access this application. Contact your administrator.' });
      }
    } catch (error) {
      setErrors({ auth: error instanceof AuthRequestError && (error.status === 400 || error.status === 401)
        ? 'Incorrect email or password.'
        : error instanceof TypeError || (error instanceof AuthRequestError && error.status >= 500)
          ? 'Unable to reach ShelfLife AI. Please try again in a moment.'
          : 'Unable to complete log in. Please try again.' });
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  const handleFirstPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setNewPasswordTouched(true);
    setConfirmPasswordTouched(true);
    setTermsAttempted(true);
    if (newPassword.length < 12) { newPasswordInput.current?.focus(); return; }
    if (newPassword !== confirmPassword) { confirmPasswordInput.current?.focus(); return; }
    if (!termsAccepted) return;
    submitting.current = true;
    setIsLoading(true);
    setErrors({});
    try {
      await changePassword(temporaryPassword, newPassword);
      clearSession();
      setTemporaryPassword(''); setNewPassword(''); setConfirmPassword(''); setFirstLogin(false); setTermsReached(false); setTermsAccepted(false); setPasswordChanged(true);
    } catch (error) {
      setErrors({ auth: error instanceof AuthRequestError ? error.message : 'Unable to update your password. Please try again.' });
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  if (firstLogin && showFirstLoginTerms) return <FirstLoginTermsPage
    reachedBottom={termsReached}
    accepted={termsAccepted}
    onReachBottom={() => setTermsReached(true)}
    onAcceptedChange={setTermsAccepted}
    onBack={() => setShowFirstLoginTerms(false)}
    onContinue={() => { setTermsAccepted(true); setTermsAttempted(false); setShowFirstLoginTerms(false); setErrors({}); }}
  />;

  return (
    <div className={`sl-app sl-login${firstLogin ? ' sl-login-first-setup' : ''}`}>
      <main className="sl-login-layout">
        <section className="sl-login-intro" aria-labelledby="sl-product-title">
          <header className="sl-login-brand"><a href="/ShelfLifeAILogin" aria-label="ShelfLife AI — return to clean login" className="sl-login-home"><Brand inverse login /></a></header>
          <p className="sl-eyebrow">For food-service teams</p>
          <h2 id="sl-product-title">Intelligent inventory.<br /><span>Less food waste.</span></h2>
          <div className="sl-login-intro-footer">
            <span className="sl-login-rule" aria-hidden="true" />
            <p>Intelligent Inventory, Expiry and Demand Forecasting System</p>
          </div>
        </section>
        <section className="sl-login-form-panel" aria-labelledby="sl-login-title">
          <div className="sl-login-form-heading">
            <h1 id="sl-login-title" className="sl-page-title">{firstLogin ? 'Set your new password' : 'Welcome Back!'}</h1>
            <p className="sl-description">{firstLogin ? 'Welcome to ShelfLife AI! Choose a personal password to activate your account.' : passwordChanged ? 'Your password has been changed. Sign in using your new password.' : 'Please enter your login details below.'}</p>
          </div>
          {firstLogin ? <form noValidate onSubmit={handleFirstPasswordChange} aria-labelledby="sl-login-title" aria-busy={isLoading}>
            {errors.auth && <div tabIndex={-1} className="sl-form-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><p>{errors.auth}</p></div>}
            <div className="sl-field">
              <label htmlFor="sl-new-password">New password</label>
              <div className="sl-password-field">
                <input id="sl-new-password" ref={newPasswordInput} type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128}
                  aria-invalid={!!newPasswordError} aria-describedby={newPasswordError ? 'sl-new-password-error' : newPasswordFocused ? 'sl-new-password-hint' : undefined}
                  value={newPassword} disabled={isLoading} onFocus={() => setNewPasswordFocused(true)}
                  onBlur={() => { setNewPasswordFocused(false); setNewPasswordTouched(true); }}
                  onChange={event => { setNewPassword(event.target.value); setErrors({}); }} />
                <button className="sl-password-toggle" type="button" disabled={isLoading}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-controls="sl-new-password"
                  onClick={() => setShowNewPassword(value => !value)}>
                  {showNewPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
              {newPasswordError
                ? <p className="sl-field-error" id="sl-new-password-error" role="alert">{newPasswordError}</p>
                : newPasswordFocused && <p className="sl-first-login-password-hint" id="sl-new-password-hint"><Info size={16} aria-hidden="true" />Use at least 12 characters.</p>}
            </div>
            <div className="sl-field">
              <label htmlFor="sl-confirm-password">Confirm new password</label>
              <div className="sl-password-field">
                <input id="sl-confirm-password" ref={confirmPasswordInput} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128}
                  aria-invalid={!!confirmPasswordError} aria-describedby={confirmPasswordError ? 'sl-confirm-password-error' : undefined}
                  value={confirmPassword} disabled={isLoading} onBlur={() => setConfirmPasswordTouched(true)}
                  onChange={event => { setConfirmPassword(event.target.value); setErrors({}); }} />
                <button className="sl-password-toggle" type="button" disabled={isLoading}
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'} aria-controls="sl-confirm-password"
                  onClick={() => setShowConfirmPassword(value => !value)}>
                  {showConfirmPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
              {confirmPasswordError && <p className="sl-field-error" id="sl-confirm-password-error" role="alert">{confirmPasswordError}</p>}
            </div>
            <section className="sl-first-login-policy-link" aria-labelledby="sl-first-login-policy-title">
              <span className="sl-first-login-policy-icon" aria-hidden="true"><FileText size={24} /></span>
              <div className="sl-first-login-policy-copy"><h2 id="sl-first-login-policy-title">Terms and Privacy Policy</h2><p>{termsAccepted ? 'You accepted the policy. You can return to review it.' : 'Please read and accept before you continue.'}</p></div>
              <button type="button" onClick={() => setShowFirstLoginTerms(true)} disabled={isLoading}
                aria-describedby={termsAttempted && !termsAccepted ? 'sl-first-login-policy-error' : undefined}>
                {termsAccepted ? 'Review policy' : 'Read and accept'}
              </button>
            </section>
            {termsAttempted && !termsAccepted && <p className="sl-first-login-policy-error" id="sl-first-login-policy-error" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />Read and accept the Terms and Privacy Policy before setting your password.
            </p>}
            <button className="sl-button sl-button-primary sl-login-submit" type="submit" disabled={isLoading}><span>{isLoading ? 'Updating...' : 'Set new password'}</span></button>
          </form> : <form noValidate onSubmit={handleSubmit} aria-labelledby="sl-login-title" aria-describedby={errors.auth ? 'sl-auth-error' : undefined} aria-busy={isLoading}>
            {errors.auth && <div ref={errorSummary} tabIndex={-1} id="sl-auth-error" className="sl-form-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><p>{errors.auth}</p></div>}
            <div className="sl-field">
              <label htmlFor="sl-email">Email</label>
              <input id="sl-email" ref={emailInput} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254}
                value={email} disabled={isLoading} placeholder="Enter your email" aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'sl-email-error' : undefined}
                onChange={event => { setEmail(event.target.value); setErrors(previous => ({ ...previous, email: undefined, auth: undefined })); }} />
              {errors.email && <p className="sl-field-error" id="sl-email-error" role="alert">{errors.email}</p>}
            </div>
            <div className="sl-field">
              <label htmlFor="sl-password">Password</label>
              <div className="sl-password-field">
                <input id="sl-password" ref={passwordInput} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={128}
                  value={password} disabled={isLoading} placeholder="Enter your password" aria-invalid={!!errors.password}
                  aria-describedby="sl-password-feedback"
                  onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                  onChange={event => { setPassword(event.target.value); setErrors(previous => ({ ...previous, password: undefined, auth: undefined })); }} />
                <button className="sl-password-toggle" type="button" disabled={isLoading} aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="sl-password" onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
              {/* Entry feedback only; it never scores passwords or changes sign-in eligibility. */}
              <p className={errors.password ? 'sl-password-feedback sl-field-error' : 'sl-password-feedback sl-field-attention'} id="sl-password-feedback" role={errors.password ? 'alert' : 'status'}>
                {errors.password || (capsLock ? 'Caps Lock is on.' : '')}
              </p>
            </div>
            <div className="sl-login-options">
              <label className="sl-remember"><input type="checkbox" checked={rememberMe} disabled={isLoading} onChange={event => setRememberMe(event.target.checked)} />Remember me</label>
              <button ref={recoveryButton} type="button" className="sl-text-action" onClick={() => setRecoveryOpen(true)}>Forgot Password</button>
            </div>
          <button className="sl-button sl-button-primary sl-login-submit" type="submit" disabled={isLoading}>
              {isLoading ? <LoaderCircle size={18} className="sl-spin" aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
              <span>{isLoading ? 'Logging in...' : 'Log in'}</span>
            </button>
          </form>
          }
        </section>
      </main>
      <Dialog open={recoveryOpen} title="Password recovery" onDismiss={() => { setRecoveryOpen(false); setResetToken(undefined); }} returnFocus={recoveryButton}>
        {recoveryOpen && <PasswordRecovery token={resetToken} />}
      </Dialog>
    </div>
  );
}
