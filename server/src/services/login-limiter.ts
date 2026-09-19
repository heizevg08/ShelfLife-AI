import { createHash } from 'node:crypto';
import { HttpError } from '../middleware/error.middleware';
import type { loginAttemptModel } from '../models/login-attempt';

export const LOGIN_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export interface LoginAttemptStore {
  reserve(key: string, now: Date): Promise<{ allowed: boolean; expiresAt: Date }>;
  finish(key: string, expiresAt: Date, success: boolean): Promise<void>;
}
export function mongoLoginAttemptStore(model: ReturnType<typeof loginAttemptModel>): LoginAttemptStore {
  return {
    async reserve(key, now) {
      const expiresAt = new Date(now.getTime() + LOGIN_WINDOW_MS);
      try {
        // Reserve before password hashing so concurrent attempts cannot bypass the limit.
        const row = await model.findOneAndUpdate({ _id: key, $or: [{ expiresAt: { $lte: now } }, { attempts: { $lt: LOGIN_LIMIT } }] }, [
          { $set: {
            attempts: { $cond: [{ $gt: ['$expiresAt', now] }, { $add: ['$attempts', 1] }, 1] },
            expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', expiresAt] },
          } },
        ], { upsert: true, returnDocument: 'after', updatePipeline: true }).lean().exec();
        return { allowed: true, expiresAt: row!.expiresAt };
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
        // The unique _id rejects an upsert when the existing window is full.
        const row = await model.findById(key).lean().exec();
        return { allowed: false, expiresAt: row?.expiresAt ?? expiresAt };
      }
    },
    async finish(key, expiresAt, success) {
      if (success) await model.deleteOne({ _id: key, expiresAt }).exec();
      else await model.updateOne({ _id: key, expiresAt, attempts: { $gt: 0 } }, { $inc: { attempts: -1 } }).exec();
    },
  };
}
// Used by isolated app instances/tests. The executable server explicitly supplies MongoDB storage.
export function memoryLoginAttemptStore(): LoginAttemptStore {
  const rows = new Map<string, { attempts: number; expiresAt: Date }>();
  return {
    async reserve(key, now) {
      for (const [id, row] of rows) if (row.expiresAt <= now) rows.delete(id);
      const row = rows.get(key) ?? { attempts: 0, expiresAt: new Date(now.getTime() + LOGIN_WINDOW_MS) };
      rows.set(key, row);
      const allowed = row.attempts < LOGIN_LIMIT;
      if (allowed) row.attempts++;
      return { allowed, expiresAt: row.expiresAt };
    },
    async finish(key, expiresAt, success) {
      const row = rows.get(key);
      if (row?.expiresAt.getTime() !== expiresAt.getTime()) return;
      if (success) rows.delete(key);
      else row!.attempts--;
    },
  };
}
export function createLoginLimiter(store: LoginAttemptStore, clock = () => new Date()) {
  return {
    async run<T>(email: unknown, ip: string, login: () => Promise<T>, retryAfter: (seconds: number) => void): Promise<T> {
      const account = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const key = createHash('sha256').update(JSON.stringify([account, ip])).digest('hex');
      const now = clock();
      const slot = await store.reserve(key, now);
      if (!slot.allowed) {
        retryAfter(Math.max(1, Math.ceil((slot.expiresAt.getTime() - now.getTime()) / 1000)));
        throw new HttpError(429, 'Too many login attempts. Try again later.');
      }
      let result: T;
      try { result = await login(); }
      catch (error) {
        // Credential failures consume a slot; infrastructure failures do not.
        if (!(error instanceof HttpError && error.status === 401)) await store.finish(key, slot.expiresAt, false);
        throw error;
      }
      await store.finish(key, slot.expiresAt, true);
      return result;
    },
  };
}
export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
