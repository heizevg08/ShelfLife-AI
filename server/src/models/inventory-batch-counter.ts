import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, required: true, min: 1 },
}, { collection: 'inventoryBatchCounters', versionKey: false, strict: 'throw' });

export function inventoryBatchCounterModel(driver: Mongoose) { return driver.model('InventoryBatchCounter', schema); }
