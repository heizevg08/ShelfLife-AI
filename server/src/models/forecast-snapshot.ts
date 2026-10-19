import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

const schema = new Schema({
  ingredientId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Ingredient', index: true },
  generatedAt: { type: Date, required: true, immutable: true, index: true },
  generatedDate: { type: String, required: true, immutable: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  targetDate: { type: String, required: true, immutable: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  horizonDays: { type: Number, required: true, min: 1, max: 30, immutable: true },
  stepIndex: { type: Number, required: true, min: 0, max: 29, immutable: true },
  predictedQuantity: { type: Number, required: true, min: 0, immutable: true },
  unit: { type: String, required: true, trim: true, maxlength: 50, immutable: true },
  modelVersion: { type: String, required: true, immutable: true, default: 'v1.0-frozen-rf' },
  modelStage: { type: String, required: true, immutable: true, default: 'inference-frozen' },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
  status: { type: String, required: true, enum: ['ACTIVE', 'SUPERSEDED'], default: 'ACTIVE', index: true },
}, { timestamps: true, versionKey: false, collection: 'forecastSnapshots', strict: 'throw' });

schema.index({ ingredientId: 1, generatedDate: 1, targetDate: 1 }, { unique: true });
schema.index({ ingredientId: 1, targetDate: 1, status: 1 });
schema.index({ generatedAt: 1 }, { expireAfterSeconds: 90 * 86400 });

export type ForecastSnapshotRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function forecastSnapshotModel(driver: Mongoose) { return driver.model('ForecastSnapshot', schema); }
