import { Schema, type Mongoose, type InferSchemaType } from 'mongoose';
import { normalizeEmail } from '../validators/auth';

export const ROLES = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;
export type UserRole = typeof ROLES[number];

const LEGACY_ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  SuperAdmin: 'Super Admin',
  'Inventory Manager': 'Manager',
  InventoryStaff: 'Inventory Staff',
};

export function normalizeUserRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') return null;
  if ((ROLES as readonly string[]).includes(role)) return role as UserRole;
  return LEGACY_ROLE_ALIASES[role] ?? null;
}

export function storedUserRoles(roles: readonly string[]): string[] {
  const requested = new Set(roles.map(normalizeUserRole).filter((role): role is UserRole => role !== null));
  return [
    ...ROLES.filter(role => requested.has(role)),
    ...Object.entries(LEGACY_ROLE_ALIASES).filter(([, role]) => requested.has(role)).map(([alias]) => alias),
  ];
}
const schema = new Schema({
  email: { type: String, required: true, unique: true, set: (value: string) => value.trim().toLowerCase(), validate: (value: string) => normalizeEmail(value) === value },
  // Legacy/current database records may carry the canonical display name in `name`.
  // Keep it readable so authenticated UI identity reflects the database value instead of stale first/last-name fields.
  name: { type: String, trim: true, maxlength: 200 },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  passwordHash: { type: String, required: true, select: false, match: /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/ },
  role: { type: String, required: true, enum: ROLES },
  isActive: { type: Boolean, required: true, default: true },
  lastLoginAt: { type: Date },
  authVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false },
}, { timestamps: true, versionKey: false, collection: 'users', strict: 'throw' });

export type UserRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function userModel(driver: Mongoose) {
  return driver.model('User', schema);
}
export function safeUser(user: UserRecord) {
  const role = normalizeUserRole(user.role) ?? user.role;
  const storedName = typeof user.name === 'string' ? user.name.trim() : '';
  const composedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  let displayName = storedName || composedName || role;
  // Older seeded records used role labels as first/last names. Do not let a stale
  // "Super Admin" label leak into an account whose authoritative role is Admin.
  if (role === 'Admin' && displayName === 'Super Admin') displayName = 'Admin';
  if (role === 'Super Admin' && displayName === 'Admin') displayName = 'Super Admin';
  return { id: user._id.toString(), name: displayName, email: user.email,
    role, isActive: user.isActive, ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}) };
}
