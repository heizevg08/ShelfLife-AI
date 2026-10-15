import { HttpError } from '../middleware/error.middleware';
import { validPassword } from '../validators/auth';
import { hashPassword, verifyPassword } from './password';

export interface PasswordChangeRecord { _id: { toString(): string }; passwordHash?: string; isActive: boolean }
export interface PasswordChangeStore {
  byIdWithHash(id: string): Promise<PasswordChangeRecord | null>;
  // One atomic write replaces the hash and revokes every issued access and refresh
  // credential by bumping the account's authorization version, matching the policy the
  // recovery flow already applies.
  applyPasswordChange(id: string, passwordHash: string): Promise<boolean>;
}
const requirement = 'Use at least 12 characters for your new password';
const wrongCurrent = 'Your current password is incorrect';
// An authenticated password change. The account is taken from the verified access token,
// never from the request body, so the endpoint can only ever change the caller's own
// password. Neither the submitted nor the stored credential is ever echoed or logged.
export function createPasswordChange(store: PasswordChangeStore) {
  return {
    async change(userId: string, body: unknown) {
      const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
      const currentPassword = input.currentPassword;
      const newPassword = input.newPassword;
      if (!validPassword(currentPassword)) throw new HttpError(400, 'Enter your current password');
      // Same policy the administrator create path and the recovery completion path enforce.
      if (!validPassword(newPassword) || newPassword.length < 12) throw new HttpError(400, requirement);
      const account = await store.byIdWithHash(userId);
      if (!account || account.isActive !== true || !account.passwordHash) throw new HttpError(400, wrongCurrent);
      if (!await verifyPassword(currentPassword, account.passwordHash)) throw new HttpError(400, wrongCurrent);
      if (!await store.applyPasswordChange(userId, await hashPassword(newPassword)))
        throw new HttpError(400, 'Unable to update your password. Try again.');
      return { message: 'Password updated. Sign in again with your new password.' };
    },
  };
}
export type PasswordChange = ReturnType<typeof createPasswordChange>;
