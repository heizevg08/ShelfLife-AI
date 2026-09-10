import { Schema, type Mongoose, type InferSchemaType } from 'mongoose';
import { normalizeEmail } from '../validators/auth';

export const ROLES = ['Super Admin', 'Admin', 'Manager', 'Inventory Staff'] as const;
const schema = new Schema({
  email: { type: String, required: true, unique: true, set: (value: string) => value.trim().toLowerCase(), validate: (value: string) => normalizeEmail(value) === value },
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
  return { id: user._id.toString(), name: `${user.firstName} ${user.lastName}`, email: user.email,
    role: user.role, isActive: user.isActive };
}
