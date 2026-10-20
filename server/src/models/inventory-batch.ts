import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

const schema = new Schema({
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  batchID: { type: String, required: true, trim: true, maxlength: 100 },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 50 },
  dateReceived: { type: Date, required: true },
  expirationDate: { type: Date, required: true, index: true },
  unitCost: { type: Number, min: 0 },
  status: { type: String, trim: true, maxlength: 50 },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
}, { timestamps: true, versionKey: false, collection: 'inventorybatches', strict: 'throw' });

schema.index({ batchID: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
schema.index({ createdAt: -1, _id: -1 });

export type InventoryBatchRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };

/**
 * Create, or reuse, the model for stock batches.
 *
 * @param driver - the Mongoose instance, so tests can pass their own.
 * @returns the inventory batch model.
 */
export function inventoryBatchModel(driver: Mongoose) { return driver.model('InventoryBatch', schema); }
