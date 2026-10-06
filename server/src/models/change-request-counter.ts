import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  dateKey: { type: String, required: true, immutable: true, unique: true, match: /^\d{8}$/ },
  sequence: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
}, { versionKey: false, collection: 'changeRequestCounters', strict: 'throw' });

export function changeRequestCounterModel(driver: Mongoose) { return driver.model('ChangeRequestCounter', schema); }
