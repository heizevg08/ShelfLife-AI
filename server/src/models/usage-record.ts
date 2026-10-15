import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

const schema = new Schema({
  batchId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'InventoryBatch', index: true },
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  quantityUsed: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
  dateUsed: { type: Date, required: true, immutable: true, index: true },
  staffId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User', index: true },
}, { timestamps: true, versionKey: false, collection: 'usageRecords', strict: 'throw' });

schema.index({ dateUsed: -1, _id: -1 });
schema.index({ ingredientId: 1, dateUsed: -1 });
schema.index({ batchId: 1, dateUsed: -1 });

export type UsageRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function usageRecordModel(driver: Mongoose) { return driver.model('UsageRecord', schema); }
