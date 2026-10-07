import { createLoginLimiter, memoryLoginAttemptStore, type LoginLimiter } from '../services/login-limiter';
import { Router } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';
import type { PersistentSessions } from '../services/persistent-session';
import type { PasswordRecovery } from '../services/password-recovery';
import { HttpError } from '../middleware/error.middleware';
import { authBodyFields, emptyAuthBody, loginInput } from '../validators/auth';

export interface AuthExtensions { loginLimiter?: LoginLimiter; sessions?: PersistentSessions; recovery?: PasswordRecovery; secureCookies?: boolean }

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
  const noQuery = (req: { query: Record<string, unknown> }) => {
    if (Object.keys(req.query).length) throw new HttpError(400, 'Invalid request');
  };
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/login', async (req, res) => {
    noQuery(req);
    let remembered = false;
    const result = await limiter.run(req.body?.email, req.ip ?? req.socket.remoteAddress ?? 'unknown', async () => {
      const input = loginInput(req.body);
      if (!input) throw new HttpError(401, 'Invalid email or password');
      remembered = input.rememberMe;
      return auth.login(req.body);
    }, seconds => res.setHeader('Retry-After', String(seconds)));
    const previous = cookie(req.headers.cookie);
    if (remembered || previous) {
      verifyOrigin(req.headers.origin);
      if (!extensions.sessions) throw new HttpError(503, 'Persistent sessions unavailable');
      await extensions.sessions.revoke(previous);
      if (req.body?.rememberMe === true) {
        const session = await extensions.sessions.create(result.user.id);
        res.cookie(cookieName, session.token, { ...cookieOptions, expires: session.expiresAt });
      } else res.clearCookie(cookieName, cookieOptions);
    }
    res.json(result);
  });
  router.post('/refresh', async (req, res) => {
    noQuery(req); if (!emptyAuthBody(req.body)) throw new HttpError(400, 'Invalid request');
    verifyOrigin(req.headers.origin);
    if (!extensions.sessions) throw new HttpError(401, 'Authentication required');
    try {
      const { token, expiresAt, ...result } = await extensions.sessions.refresh(cookie(req.headers.cookie));
      res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt });
      res.json(result);
    } catch (error) { res.clearCookie(cookieName, cookieOptions); throw error; }
  });
  router.post('/logout', async (req, res) => {
    noQuery(req); if (!emptyAuthBody(req.body)) throw new HttpError(400, 'Invalid request');
    verifyOrigin(req.headers.origin);
    await extensions.sessions?.revoke(cookie(req.headers.cookie));
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  router.get('/password-reset/availability', (req, res) => { noQuery(req); res.json({ available: extensions.recovery?.available === true }); });
  router.post('/password-reset/request', async (req, res) => {
    noQuery(req);
    if (!authBodyFields(req.body, ['email'])) throw new HttpError(400, 'Invalid request');
    if (!extensions.recovery) throw new HttpError(503, 'Password recovery is awaiting email delivery setup');
    res.json(await extensions.recovery.request(req.body));
  });
  router.post('/password-reset/complete', async (req, res) => {
    noQuery(req);
    if (!authBodyFields(req.body, ['token', 'password'])) throw new HttpError(400, 'Invalid request');
    if (!extensions.recovery) throw new HttpError(503, 'Password recovery unavailable');
    res.json(await extensions.recovery.complete(req.body));
  });
  router.get('/me', (req, _res, next) => { noQuery(req); next(); }, authenticate(auth), (_req, res) => { res.json({ user: res.locals.user }); });
  return router;
}
