import { Schema, type Mongoose } from 'mongoose';

export function persistentSessionModel(driver: Mongoose) {
  return driver.model('PersistentSession', new Schema({
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    authVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  }, { collection: 'authSessions', versionKey: false, strict: 'throw' }));
}
