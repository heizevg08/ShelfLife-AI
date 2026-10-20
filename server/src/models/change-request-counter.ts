import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({ dateKey: { type: String, required: true, unique: true, immutable: true }, sequence: { type: Number, required: true, min: 0 } }, { versionKey: false, collection: 'changeRequestCounters', strict: 'throw' });

/**
 * Create, or reuse, the model that numbers change requests per day.
 *
 * @param driver - the Mongoose instance, so tests can pass their own.
 * @returns the change-request counter model.
 */
export function changeRequestCounterModel(driver: Mongoose) { return driver.model('ChangeRequestCounter', schema); }
