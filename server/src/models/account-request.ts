import { Schema, type Mongoose } from 'mongoose';
import { ROLES } from './user';

const schema = new Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 25 },
  lastName: { type: String, required: true, trim: true, maxlength: 25 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  role: { type: String, required: true, enum: ['Admin', 'Inventory Manager', 'Inventory Staff'] },
  requestedBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
  requestedByRole: { type: String, required: true, enum: ROLES, immutable: true },
  status: { type: String, required: true, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  accountId: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, required: true, default: false },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
}, { timestamps: true, versionKey: false, collection: 'accountRequests', strict: 'throw' });

schema.index({ requestedBy: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });

export function accountRequestModel(driver: Mongoose) { return driver.model('AccountRequest', schema); }