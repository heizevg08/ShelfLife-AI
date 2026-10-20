import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  tokenHash: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  authVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'authSessions', versionKey: false, strict: 'throw' });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'persistent_session_expiry' });

/**
 * Create, or reuse, the model for sessions that survive a restart.
 *
 * @param driver - the Mongoose instance, so tests can pass their own.
 * @returns the persistent session model.
 */
export function persistentSessionModel(driver: Mongoose) {
  return driver.model('PersistentSession', schema);
}
