import mongoose, { Document, Schema, Types } from "mongoose";

export interface IIngredient extends Document {
  name: string;
  brand: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  minimumStock: number;
  standardUnitCost: number;
  defaultShelfLifeDays: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ingredientSchema = new Schema<IIngredient>(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    unitOfMeasure: { type: String, required: true },
    minimumStock: { type: Number, required: true, min: 0 },
    standardUnitCost: { type: Number, required: true, min: 0 },
    defaultShelfLifeDays: { type: Number, required: true, min: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IIngredient>("Ingredient", ingredientSchema);
