import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({ dateKey: { type: String, required: true, unique: true, immutable: true }, sequence: { type: Number, required: true, min: 0 } }, { versionKey: false, collection: 'changeRequestCounters', strict: 'throw' });

export function changeRequestCounterModel(driver: Mongoose) { return driver.model('ChangeRequestCounter', schema); }
