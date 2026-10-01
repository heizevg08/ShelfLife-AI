import { Schema, type Mongoose } from 'mongoose';

export const CHANGE_REQUEST_TYPES = ['MINIMUM_STOCK_CHANGE', 'STANDARD_UNIT_COST_CHANGE', 'CATEGORY_CHANGE', 'BRAND_CHANGE', 'DESCRIPTION_CHANGE', 'UNIT_OF_MEASURE_CHANGE', 'DEFAULT_SHELF_LIFE_CHANGE'] as const;
export const LEGACY_CHANGE_REQUEST_TYPES = ['BATCH_CORRECTION', 'QUANTITY_ADJUSTMENT', 'UNIT_CORRECTION', 'ADD_MISSING_BATCH', 'OTHER'] as const;
export const CHANGE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const CHANGE_REQUEST_TARGET_FIELDS = ['minimumStock', 'standardUnitCost', 'category', 'brand', 'description', 'unitOfMeasure', 'defaultShelfLifeDays'] as const;

const schema = new Schema({
  requestID: { type: String, required: true, immutable: true, unique: true, index: true, maxlength: 32 },
  requestType: { type: String, required: true, enum: [...CHANGE_REQUEST_TYPES, ...LEGACY_CHANGE_REQUEST_TYPES], immutable: true },
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  targetField: { type: String, required: true, enum: CHANGE_REQUEST_TARGET_FIELDS, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  currentValue: { type: String, required: true, trim: true, maxlength: 1000, immutable: true },
  requestedValue: { type: String, required: true, trim: true, maxlength: 1000, immutable: true },
  status: { type: String, required: true, enum: CHANGE_REQUEST_STATUSES, default: 'PENDING', index: true },
  requestedBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true, versionKey: false, collection: 'changeRequests', strict: 'throw' });
schema.index({ requestedBy: 1, createdAt: -1, _id: -1 });

export function changeRequestModel(driver: Mongoose) { return driver.model('ChangeRequest', schema); }
