import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUsageRecord extends Document {
  batchId: Types.ObjectId;
  ingredientId: Types.ObjectId;
  quantityUsed: number;
  unit: string;
  dateUsed: Date;
  staffId: Types.ObjectId;
  createdAt: Date;
}

const usageRecordSchema = new Schema<IUsageRecord>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: "InventoryBatch", required: true },
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantityUsed: { type: Number, required: true, min: 0.0001 },
    unit: { type: String, required: true },
    dateUsed: { type: Date, required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IUsageRecord>("UsageRecord", usageRecordSchema);
