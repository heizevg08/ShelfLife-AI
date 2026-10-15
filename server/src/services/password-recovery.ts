import { randomBytes } from 'node:crypto';
import { HttpError } from '../middleware/error.middleware';
import { normalizeEmail, validPassword } from '../validators/auth';
import { hashPassword } from './password';
import { tokenHash, validOpaqueToken } from './persistent-session';
import { eligible, type UserStore } from './auth';
import type { ResetEmail } from './reset-email';

export interface RecoveryStore extends UserStore {
  setReset(id: string, hash: string, expires: Date): Promise<unknown>;
  consumeReset(hash: string, now: Date, passwordHash: string): Promise<boolean>;
  clearReset(hash: string): Promise<unknown>;
}
const generic = { message: 'If the account is eligible, recovery instructions will be requested. Check your inbox.' };
export function createPasswordRecovery(store: RecoveryStore, email?: ResetEmail, now = () => new Date()) {
  return {
    available: !!email,
    async request(body: unknown) {
      if (!email) throw new HttpError(503, 'Password recovery is awaiting email delivery setup');
      const address = normalizeEmail((body as { email?: unknown } | null)?.email);
      const user = address ? await store.byEmail(address) : null;
      if (!eligible(user)) return generic;
      const token = randomBytes(32).toString('hex'), hash = tokenHash(token);
      await store.setReset(user._id.toString(), hash, new Date(now().getTime() + 900000));
      try { await email.send(user.email, token); }
      catch { await store.clearReset(hash); }
      // Same public response for unknown accounts and provider failures; never claim delivery.
      return generic;
    },
    async complete(body: unknown) {
      const input = body as { token?: unknown; password?: unknown } | null;
      if (!validOpaqueToken(input?.token) || !validPassword(input?.password) || input.password.length < 12)
        throw new HttpError(400, 'Invalid or expired reset request, or password does not meet requirements');
      const hash = await hashPassword(input.password);
      if (!await store.consumeReset(tokenHash(input.token), now(), hash))
        throw new HttpError(400, 'Invalid or expired reset request, or password does not meet requirements');
      return { message: 'Password updated. Log in with your new password.' };
    },
  };
}
export type PasswordRecovery = ReturnType<typeof createPasswordRecovery>;
