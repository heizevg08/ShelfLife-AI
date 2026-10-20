import { Schema, type Mongoose, type InferSchemaType } from 'mongoose';
import { normalizeEmail, normalizePersonalEmail } from '../validators/auth';

export const ROLES = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;
export type UserRole = typeof ROLES[number];

const LEGACY_ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  SuperAdmin: 'Super Admin',
  'Inventory Manager': 'Manager',
  InventoryStaff: 'Inventory Staff',
};

/**
 * Map a stored role value onto a known role name.
 *
 * @param role - the raw value read from storage or a request.
 * @returns the canonical role name, or null when the value is unknown.
 */
export function normalizeUserRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') return null;
  if ((ROLES as readonly string[]).includes(role)) return role as UserRole;
  return LEGACY_ROLE_ALIASES[role] ?? null;
}

/**
 * Roles exactly as the user collection stores them.
 *
 * Duplicates are dropped and unknown roles are kept, so a role this build does
 * not know about is never silently rewritten in the database.
 *
 * @returns the stored role list.
 */
export function storedUserRoles(roles: readonly string[]): string[] {
  const requested = new Set(roles.map(normalizeUserRole).filter((role): role is UserRole => role !== null));
  return [
    ...ROLES.filter(role => requested.has(role)),
    ...Object.entries(LEGACY_ROLE_ALIASES).filter(([, role]) => requested.has(role)).map(([alias]) => alias),
  ];
}
const schema = new Schema({
  email: { type: String, required: true, unique: true, set: (value: string) => value.trim().toLowerCase(), validate: (value: string) => normalizeEmail(value) === value },
  personalEmail: { type: String, trim: true, lowercase: true, maxlength: 254, validate: (value: string) => normalizePersonalEmail(value) === value },
  // Legacy/current database records may carry the canonical display name in `name`.
  // Keep it readable so authenticated UI identity reflects the database value instead of stale first/last-name fields.
  name: { type: String, trim: true, maxlength: 200 },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  passwordHash: { type: String, required: true, select: false, match: /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/ },
  role: { type: String, required: true, enum: ROLES },
  isActive: { type: Boolean, required: true, default: true },
  // Newly provisioned accounts can authenticate only to complete first-login setup.
  mustChangePassword: { type: Boolean, required: true, default: false },
  lastLoginAt: { type: Date },
  authVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false },
  pendingEmail: { type: String, select: false, set: (value: string) => value.trim().toLowerCase(), validate: (value: string) => normalizeEmail(value) === value },
  emailChangeCodeHash: { type: String, select: false },
  emailChangeExpiresAt: { type: Date, select: false },
  emailChangeSentAt: { type: Date, select: false },
  emailChangeAttempts: { type: Number, select: false, min: 0, max: 5 },
}, { timestamps: true, versionKey: false, collection: 'users', strict: 'throw' });

// Setup addresses are optional on legacy accounts, so the sparse unique index applies
// uniqueness only when an account actually has a personal email address.
schema.index({ personalEmail: 1 }, { unique: true, sparse: true, name: 'personalEmail_1' });

export type UserRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };

/**
 * Create, or reuse, the model for user accounts.
 *
 * @param driver - the Mongoose instance, so tests can pass their own.
 * @returns the user model.
 */
export function userModel(driver: Mongoose) {
  return driver.model('User', schema);
}
function isoTimestamp(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return undefined;
}

/**
 * The user fields that may leave the server.
 *
 * @param user - the stored user record.
 * @returns the record without its password hash.
 */
export function safeUser(user: UserRecord) {
  const role = normalizeUserRole(user.role) ?? user.role;
  const storedName = typeof user.name === 'string' ? user.name.trim() : '';
  const composedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  let displayName = storedName || composedName || role;
  // Older seeded records used role labels as first/last names. Do not let a stale
  // "Super Admin" label leak into an account whose authoritative role is Admin.
  if (role === 'Admin' && displayName === 'Super Admin') displayName = 'Admin';
  if (role === 'Super Admin' && displayName === 'Admin') displayName = 'Super Admin';
  const createdAt = isoTimestamp(user.createdAt);
  const updatedAt = isoTimestamp(user.updatedAt);
  // First and last name are exposed as their own authoritative fields so a profile can
  // present them separately instead of splitting the combined display name.
  return { id: user._id.toString(), name: displayName,
    firstName: typeof user.firstName === 'string' ? user.firstName.trim() : '',
    lastName: typeof user.lastName === 'string' ? user.lastName.trim() : '',
    email: user.email,
    role, isActive: user.isActive, mustChangePassword: user.mustChangePassword === true,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
    ...(createdAt ? { createdAt } : {}), ...(updatedAt ? { updatedAt } : {}) };
}
