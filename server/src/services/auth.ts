import jwt from 'jsonwebtoken';
import type { UserRecord } from '../models/user';
import { ROLES, safeUser } from '../models/user';
import { hashPassword, verifyPassword } from './password';
import { HttpError } from '../middleware/error.middleware';
import { normalizeEmail, validPassword } from '../validators/auth';

export interface UserStore {
  byEmail(email: string): Promise<UserRecord | null>;
  byId(id: string): Promise<UserRecord | null>;
}
const options = { algorithm: 'HS256' as const, issuer: 'shelflifeai', audience: 'shelflifeai-client', expiresIn: 900 };
const denied = () => new HttpError(401, 'Invalid email or password');
function eligible(user: UserRecord | null): user is UserRecord {
  return !!user && user.isActive === true && normalizeEmail(user.email) === user.email && ROLES.includes(user.role);
}
export function createAuth(store: UserStore, secret: string) {
  let dummyHash: Promise<string> | undefined;
  return {
    async login(body: unknown) {
      const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      const email = normalizeEmail(input.email);
      if (!email || !validPassword(input.password)) throw denied();
      const user = await store.byEmail(email);
      const hash = user?.passwordHash || await (dummyHash ??= hashPassword('unused-dummy-password'));
      const matches = await verifyPassword(input.password, hash);
      if (!matches || !eligible(user)) throw denied();
      return { message: 'Login successful', accessToken: jwt.sign({}, secret, { ...options, subject: user._id.toString() }), user: safeUser(user) };
    },
    async authenticate(header: string | undefined) {
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header || '');
      let id: string;
      try {
        if (!match || match[1].length > 4096) throw new Error();
        const claims = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer: options.issuer, audience: options.audience });
        if (typeof claims === 'string' || typeof claims.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(claims.sub)
          || typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || claims.exp - claims.iat > 900) throw new Error();
        id = claims.sub;
      } catch { throw new HttpError(401, 'Authentication required'); }
      const user = await store.byId(id);
      if (!eligible(user)) throw new HttpError(401, 'Authentication required');
      return safeUser(user);
    },
  };
}
export type AuthService = ReturnType<typeof createAuth>;
