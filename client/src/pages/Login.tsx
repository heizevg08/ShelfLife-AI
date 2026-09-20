import { useRouter } from '../routing/navigation';
import { Eye, EyeOff, LoaderCircle, LogIn, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Brand } from '../components/application/Brand';
import { Dialog } from '../components/application/Dialog';
import { PasswordRecovery } from '../components/application/PasswordRecovery';
import { AuthRequestError, login } from '../services/auth';
import { clearSession } from '../services/session';
import '../styles/application.css';

interface ValidationErrors { email?: string; password?: string; auth?: string }

export default function ShelfLifeLogin({ recovery = false }: { recovery?: boolean }) {
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
  const [recoveryOpen, setRecoveryOpen] = useState(recovery);
  const recoveryButton = useRef<HTMLButtonElement>(null);
  const [resetToken, setResetToken] = useState<string>();
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (errors.auth) errorSummary.current?.focus(); }, [errors.auth]);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('reset');
    if (token) {
      // Keep the token only in component state while the reset form is open.
      void router.clearHash();
      setResetToken(token); setRecoveryOpen(true);
    }
  }, []);


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
      switch (user.role) {
        case 'Super Admin': router.replace('/SuperAdminDashboard'); break;
        case 'Admin': router.replace('/AdminDashboard'); break;
        case 'Inventory Staff': router.replace('/InventoryStaffDashboard'); break;
        case 'Inventory Manager': router.replace('/ManagerDashboard'); break;
        default:
          clearSession();
          setErrors({ auth: 'Your account cannot access this application. Contact your administrator.' });
      }
    } catch (error) {
      setErrors({ auth: error instanceof AuthRequestError && (error.status === 400 || error.status === 401)
        ? 'Incorrect email or password.'
        : error instanceof AuthRequestError && error.status === 429 ? 'Too many failed attempts. Wait 15 minutes before trying again.'
        : error instanceof TypeError || (error instanceof AuthRequestError && error.status >= 500)
          ? 'Unable to reach ShelfLife AI. Please try again in a moment.'
          : 'Unable to complete log in. Please try again.' });
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="sl-app sl-login">
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
            <h1 id="sl-login-title" className="sl-page-title">Welcome Back!</h1>
            <p className="sl-description">Please enter your login details below.</p>
          </div>
          <form noValidate onSubmit={handleSubmit} aria-labelledby="sl-login-title" aria-describedby={errors.auth ? 'sl-auth-error' : undefined} aria-busy={isLoading}>
            {errors.auth && <div ref={errorSummary} tabIndex={-1} id="sl-auth-error" className="sl-form-error" role="alert"><TriangleAlert size={18} aria-hidden="true" /><p>{errors.auth}</p></div>}
            <div className="sl-field">
              <label htmlFor="sl-email">Email</label>
              <input id="sl-email" ref={emailInput} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={email} disabled={isLoading} placeholder="Enter your email" aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'sl-email-error' : undefined}
                onChange={event => { setEmail(event.target.value); setErrors(previous => ({ ...previous, email: undefined, auth: undefined })); }} />
              {errors.email && <p className="sl-field-error" id="sl-email-error" role="alert">{errors.email}</p>}
            </div>
            <div className="sl-field">
              <label htmlFor="sl-password">Password</label>
              <div className="sl-password-field">
                <input id="sl-password" ref={passwordInput} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
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
        </section>
      </main>
      <Dialog open={recoveryOpen} title="Password recovery" onDismiss={() => { setRecoveryOpen(false); setResetToken(undefined); }} returnFocus={recoveryButton}>
        {recoveryOpen && <PasswordRecovery token={resetToken} />}
      </Dialog>
    </div>
  );
}
