import { Schema, type Mongoose } from 'mongoose';
import { decimal } from '../validators/inventory-contract';

export const SYSTEM_CONFIG_ID = '000000000000000000000001';
export const SYSTEM_DEFAULTS = Object.freeze({ approachingDays: 7, criticalDays: 2, lowStockMultiplier: '1.000', version: 0 });
const schema = new Schema({
  _id: { type: Schema.Types.ObjectId, default: SYSTEM_CONFIG_ID, validate: (value: { toString(): string }) => value.toString() === SYSTEM_CONFIG_ID },
  approachingDays: { type: Number, required: true, min: 0, max: 36500, validate: Number.isInteger },
  criticalDays: { type: Number, required: true, min: 0, max: 36500, validate: Number.isInteger },
  lowStockMultiplier: { type: Schema.Types.Decimal128, required: true, validate: (value: { toString(): string }) => { try { decimal(value.toString(), 3, 'lowStockMultiplier'); return true; } catch { return false; } } },
  version: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
}, { collection: 'systemConfig', versionKey: false, strict: 'throw', timestamps: true });
schema.pre('validate', function () { if (this.criticalDays > this.approachingDays) this.invalidate('criticalDays', 'Critical threshold must not exceed approaching threshold'); });
export function systemConfigModel(driver: Mongoose) { return driver.model('SystemConfig', schema); }
