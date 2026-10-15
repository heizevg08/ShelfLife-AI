import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

export const WASTE_REASONS = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'] as const;

const schema = new Schema({
  batchId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'InventoryBatch', index: true },
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  quantityWasted: { type: Number, required: true, min: 0, immutable: true },
  unit: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
  reason: { type: String, required: true, enum: WASTE_REASONS, immutable: true, index: true },
  wasteCost: { type: Number, required: true, min: 0, immutable: true },
  dateWasted: { type: Date, required: true, immutable: true, index: true },
  recordedBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User', index: true },
}, { timestamps: true, versionKey: false, collection: 'wasteRecords', strict: 'throw' });

schema.index({ createdAt: -1, _id: -1 });
schema.index({ ingredientId: 1, dateWasted: -1 });
schema.index({ batchId: 1, dateWasted: -1 });

export type WasteRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function wasteRecordModel(driver: Mongoose) { return driver.model('WasteRecord', schema); }
