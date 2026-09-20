import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    unitOfMeasure: { type: String, required: true }, // e.g. pcs, liters, ml, kg
    minimumStock: { type: Number, required: true, min: 0 },
    standardUnitCost: { type: Number, required: true, min: 0 },
    defaultShelfLifeDays: { type: Number, required: true, min: 1 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Ingredient", ingredientSchema);
