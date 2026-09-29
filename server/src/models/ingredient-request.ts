import { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } from './ingredient-options';
import { Schema, type Mongoose } from 'mongoose';

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 30 },
  brand: { type: String, trim: true, maxlength: 30, default: '' },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  category: { type: String, enum: INGREDIENT_CATEGORIES, required: true, trim: true },
  customCategory: { type: String, trim: true, maxlength: 50, default: '' },
  unitOfMeasure: { type: String, enum: INGREDIENT_UNITS, required: true, trim: true },
  minimumStock: { type: Number, min: 0, max: 9_999 },
  standardUnitCost: { type: Number, min: 0 },
  defaultShelfLifeDays: { type: Number, min: 1, max: 36_500 },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], required: true, default: 'Pending' },
  version: { type: Number, required: true, default: 0, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isSafeInteger },
  createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  ingredientId: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
  isDeleted: { type: Boolean, required: true, default: false },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false, collection: 'ingredientRequests', strict: 'throw' });

schema.index({ status:  1, createdAt: -1 });
schema.index({ createdBy: 1, createdAt: -1 });

export function ingredientRequestModel(driver: Mongoose) { return driver.model('IngredientRequest', schema); }
