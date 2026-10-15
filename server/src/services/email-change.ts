import { randomInt } from 'node:crypto';
import { HttpError } from '../middleware/error.middleware';
import { normalizeEmail } from '../validators/auth';
import { verifyPassword } from './password';
import { tokenHash } from './persistent-session';
import type { EmailChangeEmail } from './email-change-email';

export interface EmailChangeRecord { _id: { toString(): string }; email: string; role?: string; passwordHash?: string; isActive: boolean; emailChangeSentAt?: Date | null }
export interface EmailChangeStore {
  byIdWithSecrets(id: string): Promise<EmailChangeRecord | null>;
  emailExists(email: string, excludingId: string): Promise<boolean>;
  stage(id: string, email: string, hash: string, expiresAt: Date, sentAt: Date): Promise<boolean>;
  fail(id: string, hash: string, now: Date): Promise<number>;
  activate(id: string, hash: string, now: Date): Promise<boolean>;
  clear(id: string): Promise<unknown>;
}
// Separation of operational duties. Only the account-administration roles may change their own
// sign-in address through self-service. Managers and Inventory Staff can read their address but
// must ask an administrator, so a compromised operational session cannot silently repoint the
// account's recovery address. The store writes repeat this predicate so a direct API call cannot
// bypass the service-level check.
export const EMAIL_CHANGE_ROLES = ['Super Admin', 'Admin'] as const;
export function mayChangeOwnEmail(role: unknown): boolean {
  return typeof role === 'string' && (EMAIL_CHANGE_ROLES as readonly string[]).includes(role);
}
export function createEmailChange(store: EmailChangeStore, email?: EmailChangeEmail, now = () => new Date()) {
  return {
    available: !!email,
    async request(userId: string, body: unknown) {
      if (!email) throw new HttpError(503, 'Email changes are awaiting verified mail delivery setup');
      const input = body as { email?: unknown; currentPassword?: unknown } | null;
      const next = normalizeEmail(input?.email);
      if (!next) throw new HttpError(400, 'Use a valid @shelflife.com email address');
      if (typeof input?.currentPassword !== 'string' || !input.currentPassword) throw new HttpError(400, 'Enter your current password');
      const account = await store.byIdWithSecrets(userId);
      if (!account || !account.isActive || !account.passwordHash || !await verifyPassword(input.currentPassword, account.passwordHash))
        throw new HttpError(400, 'Your current password is incorrect');
      // Ownership verification comes first so the caller cannot probe which roles are eligible, then
      // the role policy is enforced before any code is generated or sent.
      if (!mayChangeOwnEmail(account.role)) throw new HttpError(403, 'Your email address is managed by an administrator');
      if (next === account.email) throw new HttpError(400, 'Enter a different email address');
      if (await store.emailExists(next, userId)) throw new HttpError(409, 'That email address is already in use');
      const sentAt = now();
      if (account.emailChangeSentAt && sentAt.getTime() - account.emailChangeSentAt.getTime() < 60000)
        throw new HttpError(429, 'Wait one minute before requesting another code');
      const code = randomInt(100000, 1000000).toString();
      if (!await store.stage(userId, next, tokenHash(code), new Date(sentAt.getTime() + 600000), sentAt))
        throw new HttpError(409, 'Unable to start this email change. Try again.');
      try { await email.send(next, code); }
      catch { await store.clear(userId); throw new HttpError(503, 'Verification email could not be sent'); }
      return { message: 'Enter the verification code sent to your new email address.' };
    },
    async complete(userId: string, body: unknown) {
      const code = (body as { code?: unknown } | null)?.code;
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the six-digit verification code');
      // The role policy is enforced on the confirming step too, so a direct call cannot finish a
      // change for a role that is not permitted to start one.
      const account = await store.byIdWithSecrets(userId);
      if (!account || !account.isActive) throw new HttpError(401, 'Authentication required');
      if (!mayChangeOwnEmail(account.role)) throw new HttpError(403, 'Your email address is managed by an administrator');
      const hash = tokenHash(code), instant = now();
      if (!await store.activate(userId, hash, instant)) {
        const attempts = await store.fail(userId, hash, instant);
        throw new HttpError(attempts >= 5 ? 429 : 400, attempts >= 5 ? 'Too many incorrect attempts. Request a new code.' : 'The verification code is incorrect or expired');
      }
      return { message: 'Email updated. Sign in again with your new email address.' };
    },
  };
}
export type EmailChange = ReturnType<typeof createEmailChange>;
