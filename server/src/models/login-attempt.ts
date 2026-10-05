import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  // The key is a SHA-256 digest of normalized account and socket IP; raw identifiers are never persisted.
  _id: { type: String, required: true },
  attempts: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { collection: 'loginAttempts', versionKey: false, strict: 'throw' });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'login_attempt_expiry' });

export function loginAttemptModel(driver: Mongoose) {
  return driver.model('LoginAttempt', schema);
}
