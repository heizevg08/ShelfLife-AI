import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, required: true, min: 1 },
}, { collection: 'inventoryBatchCounters', versionKey: false, strict: 'throw' });

/**
 * Create, or reuse, the model that numbers stock batches per day.
 *
 * @param driver - the Mongoose instance, so tests can pass their own.
 * @returns the batch counter model.
 */
export function inventoryBatchCounterModel(driver: Mongoose) { return driver.model('InventoryBatchCounter', schema); }
