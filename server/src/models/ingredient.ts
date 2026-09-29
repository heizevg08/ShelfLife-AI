import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from './ingredient-options';
import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 30 },
  brand: { type: String, trim: true, maxlength: 30, default: '' },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  category: { enum: INGREDIENT_CATEGORIES, type: String, required: true, trim: true, maxlength: 50 },
  customCategory: { type: String, trim: true, maxlength: 50, default: '' },
  unitOfMeasure: { enum: INGREDIENT_UNITS, type: String, required: true, trim: true, maxlength: 50 },
  minimumStock: { type: Number, min: 0, max: 9_999 },
  standardUnitCost: { type: Number, min: 0 },
  defaultShelfLifeDays: { type: Number, min: 1, max: 36_500 },
  version: { type: Number, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  isActive: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
}, { timestamps: true, versionKey: false, collection: 'ingredients', strict: 'throw' });

schema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export type IngredientRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function ingredientModel(driver: Mongoose) { return driver.model('Ingredient', schema); }
