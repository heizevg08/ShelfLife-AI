import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from './ingredient-options';
import { Schema, type InferSchemaType, type Mongoose } from 'mongoose';

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  brand: { type: String, trim: true, maxlength: 100, default: '' },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  category: { enum: INGREDIENT_CATEGORIES, type: String, required: true, trim: true, maxlength: 50 },
  unitOfMeasure: { enum: INGREDIENT_UNITS, type: String, required: true, trim: true, maxlength: 50 },
  minimumStock: { type: Number, min: 0 },
  standardUnitCost: { type: Number, min: 0 },
  defaultShelfLifeDays: { type: Number, min: 1 },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
}, { timestamps: true, versionKey: false, collection: 'ingredients', strict: 'throw' });

schema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export type IngredientRecord = InferSchemaType<typeof schema> & { _id: { toString(): string } };
export function ingredientModel(driver: Mongoose) { return driver.model('Ingredient', schema); }
