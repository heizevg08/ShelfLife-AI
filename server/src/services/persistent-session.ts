import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../middleware/error.middleware';
import { eligible, type AuthService, type UserStore } from './auth';

export const persistentLifetime = 30 * 24 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const validOpaqueToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export interface PersistentRecord { tokenHash: string; userId: { toString(): string }; authVersion: number; expiresAt: Date }
export interface PersistentStore {
  create(record: { tokenHash: string; userId: string; authVersion: number; expiresAt: Date }): Promise<unknown>;
  rotate(hash: string, next: string, now: Date): Promise<PersistentRecord | null>;
  revoke(hash: string): Promise<unknown>;
}
export function createPersistentSessions(store: PersistentStore, users: UserStore, auth: AuthService, now = () => new Date()) {
  return {
    async create(userId: string) {
      const user = await users.byId(userId);
      if (!eligible(user)) throw new HttpError(401, 'Authentication required');
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(now().getTime() + persistentLifetime);
      await store.create({ tokenHash: tokenHash(token), userId, authVersion: user.authVersion ?? 0, expiresAt });
      return { token, expiresAt };
    },
    async refresh(token: unknown) {
      if (!validOpaqueToken(token)) throw new HttpError(401, 'Authentication required');
      const next = randomBytes(32).toString('hex');
      // Atomic compare-and-replace consumes the previous token, including concurrent replays.
      const session = await store.rotate(tokenHash(token), tokenHash(next), now());
      if (!session) throw new HttpError(401, 'Authentication required');
      const user = await users.byId(session.userId.toString());
      if (!eligible(user) || (user.authVersion ?? 0) !== session.authVersion) {
        await store.revoke(tokenHash(next));
        throw new HttpError(401, 'Authentication required');
      }
      return { ...auth.issue(user), token: next, expiresAt: session.expiresAt };
    },
    async revoke(token: unknown) { if (validOpaqueToken(token)) await store.revoke(tokenHash(token)); },
  };
}
export type PersistentSessions = ReturnType<typeof createPersistentSessions>;
