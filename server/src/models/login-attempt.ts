import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true }, // SHA-256 of normalized account and socket IP; no raw identifiers.
  attempts: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'loginAttempts', versionKey: false, strict: 'throw' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export function loginAttemptModel(driver: Mongoose) { return driver.model('LoginAttempt', schema); }
