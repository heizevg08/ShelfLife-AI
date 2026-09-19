import { Schema, type Mongoose, type InferSchemaType } from 'mongoose';
import { normalizeEmail } from '../validators/auth';

export const ROLES = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'] as const;
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
  authVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false },
}, { timestamps: true, versionKey: false, collection: 'users', strict: 'throw' });

export type UserRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function userModel(driver: Mongoose) {
  return driver.model('User', schema);
}
export function safeUser(user: UserRecord) {
  const storedName = typeof user.name === 'string' ? user.name.trim() : '';
  const composedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  let displayName = storedName || composedName || user.role;
  // Older seeded records used role labels as first/last names. Do not let a stale
  // "Super Admin" label leak into an account whose authoritative role is Admin.
  if (user.role === 'Admin' && displayName === 'Super Admin') displayName = 'Admin';
  if (user.role === 'Super Admin' && displayName === 'Admin') displayName = 'Super Admin';
  return { id: user._id.toString(), name: displayName, email: user.email,
    role: user.role, isActive: user.isActive };
}
