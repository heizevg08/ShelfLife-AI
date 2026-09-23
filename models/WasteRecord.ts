import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWasteRecord extends Document {
  batchId: Types.ObjectId;
  ingredientId: Types.ObjectId;
  quantityWasted: number;
  unit: string;
  reason: string;
  wasteCost: number;
  dateWasted: Date;
  recordedBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const wasteRecordSchema = new Schema<IWasteRecord>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "InventoryBatch", required: true },
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantityWasted: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, required: true },
    reason: { type: String, required: true },
    wasteCost: { type: Number, required: true, min: 0 },
    dateWasted: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IWasteRecord>("WasteRecord", wasteRecordSchema);
