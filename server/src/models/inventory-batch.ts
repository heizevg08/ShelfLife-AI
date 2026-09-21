import { Schema, type Mongoose } from 'mongoose';
import { INGREDIENT_UNITS } from './ingredient-options';
import { calendarDate, decimal, decimalUnits } from '../validators/inventory-contract';

const validDecimal = (scale: number) => (value: { toString(): string }) => { try { decimal(value.toString(), scale, 'decimal'); return true; } catch { return false; } };
const validDate = (value: string) => { try { calendarDate(value, 'date'); return true; } catch { return false; } };
const schema = new Schema({
  ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient', required: true, immutable: true },
  batchCode: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
  initialQuantity: { type: Schema.Types.Decimal128, required: true, immutable: true, validate: validDecimal(3) },
  quantity: { type: Schema.Types.Decimal128, required: true, validate: validDecimal(3) },
  unit: { type: String, required: true, enum: INGREDIENT_UNITS },
  unitCost: { type: Schema.Types.Decimal128, required: true, validate: validDecimal(4) },
  currency: { type: String, required: true, enum: ['PHP'], default: 'PHP', immutable: true },
  // These are Manila calendar dates, not instants. ISO date-only strings sort chronologically.
  dateReceived: { type: String, required: true, validate: validDate },
  expirationDate: { type: String, required: true, validate: validDate },
  isActive: { type: Boolean, required: true, default: true },
  version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
}, { collection: 'inventoryBatches', versionKey: false, timestamps: true, strict: 'throw' });
schema.pre('validate', function () {
  if (this.expirationDate <= this.dateReceived) this.invalidate('expirationDate', 'Expiration must be after date received');
  try {
    const initial = decimalUnits(decimal(this.initialQuantity.toString(), 3, 'initialQuantity'));
    const quantity = decimalUnits(decimal(this.quantity.toString(), 3, 'quantity'));
    if (initial === 0n || quantity > initial) this.invalidate('quantity', 'Quantity must be between zero and positive initialQuantity');
  } catch { this.invalidate('quantity', 'Invalid decimal quantity'); }
});
schema.index({ ingredientId: 1, batchCode: 1 }, { unique: true, name: 'ingredient_batch_code_unique' });
schema.index({ expirationDate: 1, dateReceived: 1, _id: 1 }, { name: 'batch_fefo' });
export function inventoryBatchModel(driver: Mongoose) { return driver.model('InventoryBatch', schema); }

export async function provisionBatchIndexes(batches: ReturnType<typeof inventoryBatchModel>) {
  await batches.createIndexes();
  const indexes = await batches.collection.listIndexes().toArray();
  const identity = indexes.find(index => index.name === 'ingredient_batch_code_unique');
  if (!identity || identity.unique !== true || identity.partialFilterExpression || identity.sparse || identity.collation
    || JSON.stringify(identity.key) !== JSON.stringify({ ingredientId: 1, batchCode: 1 })) throw new Error('Required batch identity index is missing or incompatible');
  const fefo = indexes.find(index => index.name === 'batch_fefo');
  if (!fefo || JSON.stringify(fefo.key) !== JSON.stringify({ expirationDate: 1, dateReceived: 1, _id: 1 })) throw new Error('Required FEFO index is missing');
}
