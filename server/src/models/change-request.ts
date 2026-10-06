import { Schema, type Mongoose } from 'mongoose';

export const CHANGE_REQUEST_TYPES = [
  'MINIMUM_STOCK_CHANGE', 'STANDARD_UNIT_COST_CHANGE', 'CATEGORY_CHANGE', 'BRAND_CHANGE',
  'DESCRIPTION_CHANGE', 'UNIT_OF_MEASURE_CHANGE', 'DEFAULT_SHELF_LIFE_CHANGE',
] as const;
export const CHANGE_REQUEST_TARGET_FIELDS = [
  'minimumStock', 'standardUnitCost', 'category', 'brand', 'description', 'unitOfMeasure', 'defaultShelfLifeDays',
] as const;
export const CHANGE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const schema = new Schema({
  // schemaVersion makes pre-typed records unambiguously read-only history.
  schemaVersion: { type: Number, required: true, immutable: true, default: 2, enum: [2] },
  requestID: { type: String, required: true, immutable: true, maxlength: 32 },
  requestType: { type: String, required: true, immutable: true, enum: CHANGE_REQUEST_TYPES },
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  targetField: { type: String, required: true, immutable: true, enum: CHANGE_REQUEST_TARGET_FIELDS },
  reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  currentValue: { type: String, required: true, immutable: true, maxlength: 1000 },
  requestedValue: { type: String, required: true, immutable: true, maxlength: 1000 },
  ingredientVersion: { type: Number, required: true, immutable: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  status: { type: String, required: true, enum: CHANGE_REQUEST_STATUSES, default: 'PENDING', index: true },
  requestedBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true, maxlength: 500 },
  version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
}, { timestamps: true, versionKey: false, collection: 'changeRequests', strict: 'throw' });

// Typed request IDs are unique without imposing a new constraint on legacy history.
schema.index({ requestID: 1 }, { unique: true, partialFilterExpression: { schemaVersion: 2 } });
schema.index({ requestedBy: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, createdAt: -1, _id: -1 });

export function changeRequestModel(driver: Mongoose) { return driver.model('ChangeRequest', schema); }
