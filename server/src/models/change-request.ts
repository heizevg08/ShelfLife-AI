import { Schema, type Mongoose } from 'mongoose';

export const CHANGE_REQUEST_TYPES = ['BATCH_CORRECTION', 'QUANTITY_ADJUSTMENT', 'UNIT_CORRECTION', 'ADD_MISSING_BATCH', 'OTHER'] as const;
export const CHANGE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const CHANGE_REQUEST_TARGET_FIELDS = ['dateReceived', 'expirationDate', 'unitCost'] as const;

const schema = new Schema({
  requestID: { type: String, required: true, immutable: true, unique: true, index: true, maxlength: 32 },
  requestType: { type: String, required: true, enum: CHANGE_REQUEST_TYPES, immutable: true },
  ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch', index: true },
  targetField: { type: String, enum: CHANGE_REQUEST_TARGET_FIELDS, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  currentValue: { type: String, trim: true, maxlength: 500, immutable: true },
  requestedValue: { type: String, trim: true, maxlength: 1000, immutable: true },
  requestedQuantity: { type: Number, min: 0, immutable: true },
  requestedUnit: { type: String, trim: true, maxlength: 50, immutable: true },
  requestDescription: { type: String, trim: true, maxlength: 1000, immutable: true },
  proposedBatch: {
    dateReceived: { type: Date, immutable: true },
    quantityReceived: { type: Number, min: 0, immutable: true },
    expirationDate: { type: Date, immutable: true },
    unitCost: { type: Number, min: 0, immutable: true },
  },
  status: { type: String, required: true, enum: CHANGE_REQUEST_STATUSES, default: 'PENDING', index: true },
  requestedBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true, versionKey: false, collection: 'changeRequests', strict: 'throw' });
schema.index({ requestedBy: 1, createdAt: -1, _id: -1 });

export function changeRequestModel(driver: Mongoose) { return driver.model('ChangeRequest', schema); }
