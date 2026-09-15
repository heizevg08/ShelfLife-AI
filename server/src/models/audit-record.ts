import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE'], immutable: true },
  targetType: { type: String, required: true, enum: ['User'], immutable: true },
  targetId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  timestamp: { type: Date, required: true, default: Date.now, immutable: true },
}, { collection: 'auditRecords', versionKey: false, strict: 'throw' });

// Only the internal administrative transaction writes these records; no mutation API exists.
export function auditRecordModel(driver: Mongoose) { return driver.model('AuditRecord', schema); }
