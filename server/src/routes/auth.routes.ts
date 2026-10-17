import { Router } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';
import type { PersistentSessions } from '../services/persistent-session';
import type { PasswordRecovery } from '../services/password-recovery';
import { HttpError } from '../middleware/error.middleware';
import { createLoginLimiter, memoryLoginAttemptStore, type LoginLimiter } from '../services/login-limiter';

import type { PasswordChange } from '../services/password-change';
import type { ProfileUpdate } from '../services/profile-update';
import type { EmailChange } from '../services/email-change';

export interface AuthExtensions {
  loginLimiter?: LoginLimiter;
  sessions?: PersistentSessions;
  recovery?: PasswordRecovery;
  passwordChange?: PasswordChange;
  profileUpdate?: ProfileUpdate;
  emailChange?: EmailChange;
  secureCookies?: boolean;
  // Persists a LOGIN/LOGOUT audit record through the composition root's wrapped
  // audit model, so the write also feeds the in-process notification bus behind
  // the Audit Logs SSE stream. Receives identity only — never credentials,
  // tokens or session material.
  auditAuthenticationEvent?: (action: 'LOGIN' | 'LOGOUT', actor: { id: string; name: string; role: string }) => Promise<void>;
}

export function authRoutes(auth: AuthService, origins: readonly string[] = [], extensions: AuthExtensions = {}) {
  const router = Router();
  const limiter = extensions.loginLimiter ?? createLoginLimiter(memoryLoginAttemptStore());
  const cookieName = extensions.secureCookies ? '__Secure-shelflife.refresh' : 'shelflife.refresh';
  const cookieOptions = { httpOnly: true, secure: !!extensions.secureCookies, sameSite: 'lax' as const, path: '/api/auth' };
  const cookie = (header?: string) => {
    const values = (header || '').split(';').map(value => value.trim()).filter(value => value.startsWith(cookieName + '='));
    return values.length === 1 ? values[0].slice(cookieName.length + 1) : undefined;
  };
  const verifyOrigin = (origin?: string) => {
    if (!origin || !origins.includes(origin)) throw new HttpError(403, 'Request not allowed');
  };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/login', async (req, res) => {
    const result = await limiter.run(req.body?.email, req.ip ?? req.socket.remoteAddress ?? 'unknown', () => auth.login(req.body), seconds => res.setHeader('Retry-After', String(seconds)));
    const previous = cookie(req.headers.cookie);
    if (req.body?.rememberMe === true || previous) {
      verifyOrigin(req.headers.origin);
      if (!extensions.sessions) throw new HttpError(503, 'Persistent sessions unavailable');
      await extensions.sessions.revoke(previous);
      if (req.body?.rememberMe === true) {
        const session = await extensions.sessions.create(result.user.id);
        res.cookie(cookieName, session.token, { ...cookieOptions, expires: session.expiresAt });
      } else res.clearCookie(cookieName, cookieOptions);
    }
    // A successful sign-in is itself an audited event. The write is awaited before
    // the response so a persisted trail always precedes an issued token; it sits
    // after the remember-me handling so no LOGIN record exists for a request that
    // ultimately fails before delivering a session.
    await extensions.auditAuthenticationEvent?.('LOGIN', result.user);
    res.json(result);
  });
  router.post('/refresh', async (req, res) => {
    verifyOrigin(req.headers.origin);
    if (!extensions.sessions) throw new HttpError(401, 'Authentication required');
    try {
      const { token, expiresAt, ...result } = await extensions.sessions.refresh(cookie(req.headers.cookie));
      res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt });
      res.json(result);
    } catch (error) { res.clearCookie(cookieName, cookieOptions); throw error; }
  });
  router.post('/logout', async (req, res) => {
    verifyOrigin(req.headers.origin);
    // Sign-out must always succeed, even with an expired access token, so actor
    // attribution is best-effort: a still-valid bearer identifies who signed out;
    // an expired or absent one produces an unattributed revocation, never a failed
    // logout. The client always sends the bearer header on this request.
    let actor: { id: string; name: string; role: string } | undefined;
    try { actor = await auth.authenticate(req.headers.authorization); } catch { /* unattributed logout */ }
    await extensions.sessions?.revoke(cookie(req.headers.cookie));
    res.clearCookie(cookieName, cookieOptions);
    try { if (actor) await extensions.auditAuthenticationEvent?.('LOGOUT', actor); } catch { /* the session is already revoked; never fail the sign-out itself */ }
    res.status(204).end();
  });
  router.get('/password-reset/availability', (_req, res) => { res.json({ available: extensions.recovery?.available === true }); });
  router.post('/password-reset/request', async (req, res) => {
    if (!extensions.recovery) throw new HttpError(503, 'Password recovery is awaiting email delivery setup');
    res.json(await extensions.recovery.request(req.body));
  });
  router.post('/password-reset/complete', async (req, res) => {
    if (!extensions.recovery) throw new HttpError(503, 'Password recovery unavailable');
    res.json(await extensions.recovery.complete(req.body));
  });
  router.get('/me', authenticate(auth), (_req, res) => { res.json({ user: res.locals.user }); });
  router.get('/email/change/availability', authenticate(auth), (_req, res) => { res.json({ available: extensions.emailChange?.available === true }); });
  router.post('/email/change/request', authenticate(auth), async (req, res, next) => {
    try {
      if (!extensions.emailChange) throw new HttpError(503, 'Email changes unavailable');
      res.json(await extensions.emailChange.request(res.locals.user.id as string, req.body));
    } catch (error) { next(error); }
  });
  router.post('/email/change/complete', authenticate(auth), async (req, res, next) => {
    try {
      if (!extensions.emailChange) throw new HttpError(503, 'Email changes unavailable');
      res.json(await extensions.emailChange.complete(res.locals.user.id as string, req.body));
    } catch (error) { next(error); }
  });
  // Self-service account update, available to every authenticated role. Only the caller's own
  // name parts are accepted; the sign-in identifier, role, account status and credential
  // fields are refused rather than silently ignored.
  router.patch('/profile', authenticate(auth), async (req, res, next) => {
    try {
      if (!extensions.profileUpdate) throw new HttpError(503, 'Profile updates unavailable');
      res.json(await extensions.profileUpdate.update(res.locals.user.id as string, req.body));
    } catch (error) { next(error); }
  });
  // Authenticated self-service change. The account is taken from the verified access token,
  // so this endpoint can only ever change the caller's own password.
  router.post('/password/change', authenticate(auth), async (req, res, next) => {
    try {
      if (!extensions.passwordChange) throw new HttpError(503, 'Password change unavailable');
      res.json(await extensions.passwordChange.change(res.locals.user.id as string, req.body));
    } catch (error) { next(error); }
  });
  return router;
}
