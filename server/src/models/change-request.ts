import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  target: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, required: true, trim: true, maxlength: 80 },
  proposedCorrection: { type: String, required: true, trim: true, maxlength: 500 },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, required: true, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
}, { timestamps: true, versionKey: false, collection: 'changeRequests', strict: 'throw' });

schema.index({ createdBy: 1, createdAt: -1 });

export function changeRequestModel(driver: Mongoose) { return driver.model('ChangeRequest', schema); }