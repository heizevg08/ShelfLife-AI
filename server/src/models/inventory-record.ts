import { Schema, type Mongoose } from 'mongoose';
import { INGREDIENT_UNITS } from './ingredient-options';
import { calendarDate, decimal } from '../validators/inventory-contract';

export const WASTE_REASONS = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'] as const;
export type RecordKind = 'UsageRecord' | 'WasteRecord';

const validDecimal = (scale: number) => (value: { toString(): string }) => {
  try { decimal(value.toString(), scale, 'decimal'); return true; } catch { return false; }
};
const validDate = (value: string) => { try { calendarDate(value, 'recordedAt'); return true; } catch { return false; } };

export function inventoryRecordModel(driver: Mongoose, kind: RecordKind) {
  const waste = kind === 'WasteRecord';
  const schema = new Schema({
    ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true, immutable: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch', required: true, immutable: true },
    quantity: { type: Schema.Types.Decimal128, required: true, immutable: true, validate: validDecimal(3) },
    unit: { type: String, required: true, immutable: true, enum: INGREDIENT_UNITS },
    unitCostSnapshot: { type: Schema.Types.Decimal128, required: true, immutable: true, validate: validDecimal(4) },
    totalCostSnapshot: { type: Schema.Types.Decimal128, required: true, immutable: true, validate: validDecimal(2) },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    recordedAt: { type: String, required: true, immutable: true, validate: validDate },
    notes: { type: String, trim: true, maxlength: 500, default: '', immutable: true },
    ...(waste ? { reason: { type: String, enum: WASTE_REASONS, required: true, immutable: true } } : {}),
    correctionOf: { type: Schema.Types.ObjectId, ref: kind, default: null, immutable: true },
    type: { type: String, enum: ['original', 'correction'], default: 'original', immutable: true },
    isActive: { type: Boolean, required: true, default: true },
    version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  }, { collection: waste ? 'wasteRecords' : 'usageRecords', versionKey: false, timestamps: true, strict: 'throw' });
  schema.pre('validate', function () {
    if (this.type === 'original' && this.correctionOf) this.invalidate('correctionOf', 'Original records cannot reference another record');
    if (this.type === 'correction' && !this.correctionOf) this.invalidate('correctionOf', 'Correction records must reference the original record');
    if (waste && this.reason === 'Other' && !this.notes?.trim()) this.invalidate('notes', 'Notes are required for Other');
  });
  schema.index({ ingredientId: 1, recordedAt: -1, _id: -1 }, { name: 'record_ingredient_date' });
  schema.index({ batchId: 1, recordedAt: -1, _id: -1 }, { name: 'record_batch_date' });
  schema.index({ recordedBy: 1, recordedAt: -1, _id: -1 }, { name: 'record_actor_date' });
  schema.index({ correctionOf: 1, createdAt: -1, _id: -1 }, { name: 'record_correction_history' });
  return driver.model(kind, schema);
}

export const usageRecordModel = (driver: Mongoose) => inventoryRecordModel(driver, 'UsageRecord');
export const wasteRecordModel = (driver: Mongoose) => inventoryRecordModel(driver, 'WasteRecord');
