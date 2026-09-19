import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  actorType: { type: String, enum: ['User', 'System'], default: 'User', immutable: true },
  userId: { type: Schema.Types.ObjectId, required: function (this: { actorType?: string }): boolean { return this.actorType !== 'System'; }, immutable: true, default: null },
  action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'REACTIVATE'], immutable: true },
  targetType: { type: String, required: true, enum: ['User', 'Ingredient', 'InventoryBatch', 'UsageRecord', 'WasteRecord', 'AuditRecord', 'ChangeRequest', 'Alert', 'Forecast', 'SystemConfig'], immutable: true },
  targetId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  oldValue: { type: Schema.Types.Mixed, default: null, immutable: true },
  newValue: { type: Schema.Types.Mixed, default: null, immutable: true },
  timestamp: { type: Date, required: true, default: Date.now, immutable: true },
}, { collection: 'auditRecords', versionKey: false, strict: 'throw' });

// Only the internal administrative transaction writes these records; no mutation API exists.
export function auditRecordModel(driver: Mongoose) { return driver.model('AuditRecord', schema); }
