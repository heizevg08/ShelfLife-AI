import { HttpError } from '../middleware/error.middleware';
import { normalizeUserRole, safeUser, type UserRecord } from '../models/user';

// Self-service profile update shared by every authenticated role. The account is always taken
// from the verified access token, so a caller can only ever edit their own name. The sign-in
// identifier, role, account status and permission fields are not accepted by this contract at
// all: an unknown or protected field is refused instead of being silently ignored.
export interface ProfileStore {
  byId(id: string): Promise<UserRecord | null>;
  // Optimistic write. It only lands while the stored name parts are still the ones the caller
  // was shown, so two concurrent edits cannot silently overwrite each other.
  applyName(id: string, expected: { firstName: string; lastName: string }, next: { firstName: string; lastName: string; name: string }): Promise<boolean>;
}
export type ProfileAudit = (actor: { id: string; name: string; role: string }, details: string) => Promise<void>;

const editable = ['firstName', 'lastName'] as const;
type EditableField = typeof editable[number];
const labels: Record<EditableField, string> = { firstName: 'first name', lastName: 'last name' };
// The same 1-25 character rule the administrator-managed account form already enforces.
const maxLength = 25;

function cleanName(field: EditableField, value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, `Enter a valid ${labels[field]}`);
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > maxLength) throw new HttpError(400, `Enter 1-${maxLength} characters for the ${labels[field]}`);
  return clean;
}

export function createProfileUpdate(store: ProfileStore, audit?: ProfileAudit) {
  return {
    async update(userId: string, body: unknown) {
      const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
      const keys = Object.keys(input);
      if (!keys.length) throw new HttpError(400, 'Provide a first name or a last name');
      for (const key of keys) {
        if (!(editable as readonly string[]).includes(key)) throw new HttpError(400, `The ${key} field cannot be changed from your profile`);
      }
      const account = await store.byId(userId);
      if (!account || account.isActive !== true) throw new HttpError(401, 'Authentication required');
      const firstName = 'firstName' in input ? cleanName('firstName', input.firstName) : account.firstName;
      const lastName = 'lastName' in input ? cleanName('lastName', input.lastName) : account.lastName;
      // The canonical display name is derived from the authoritative parts in the same write, so
      // every reader that prefers `name` agrees with every reader that composes the two parts.
      const name = `${firstName} ${lastName}`.trim();
      const unchanged = firstName === account.firstName && lastName === account.lastName;
      if (!unchanged && !await store.applyName(userId, { firstName: account.firstName, lastName: account.lastName }, { firstName, lastName, name })) {
        throw new HttpError(409, 'Your details changed while you were editing. Reload the page and try again');
      }
      const user = safeUser({ ...account, firstName, lastName, name });
      if (!unchanged) {
        try {
          const role = normalizeUserRole(account.role);
          // No name part, credential or identifier beyond the account's own display name is
          // recorded, so the audit trail never carries a secret.
          if (role) await audit?.({ id: userId, name, role }, `Self-service account update: ${keys.map(key => labels[key as EditableField]).join(', ')}`);
        } catch {
          // The name change is already persisted. An audit write that fails must not report a
          // successful change as a failure; the gap is recorded in the private audit document.
        }
      }
      return { message: unchanged ? 'Your details are already up to date.' : 'Your details have been updated.', user };
    },
  };
}
export type ProfileUpdate = ReturnType<typeof createProfileUpdate>;
