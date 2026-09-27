import { Schema, type Mongoose } from 'mongoose';
import { ROLES } from './user';

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  actorName: { type: String, trim: true, maxlength: 200, immutable: true },
  actorRole: { type: String, enum: ROLES, immutable: true },
  action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'EXPORT'], immutable: true },
  targetType: { type: String, required: true, enum: ['User', 'Audit Records', 'InventoryBatch'], immutable: true },
  targetId: { type: Schema.Types.ObjectId, immutable: true },
  targetName: { type: String, trim: true, maxlength: 200, immutable: true },
  module: { type: String, trim: true, maxlength: 100, immutable: true },
  status: { type: String, enum: ['Success', 'Failed', 'Warning'], default: 'Success', immutable: true },
  details: { type: String, trim: true, maxlength: 500, immutable: true },
  timestamp: { type: Date, required: true, default: Date.now, immutable: true },
}, { collection: 'auditRecords', versionKey: false, strict: 'throw' });

// Only the internal administrative transaction writes these records; no mutation API exists.
export function auditRecordModel(driver: Mongoose) { return driver.model('AuditRecord', schema); }
