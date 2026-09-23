import mongoose, { Document, Schema, Types } from "mongoose";

export type AlertType = "Expiring Soon" | "Critical" | "Expired" | "Low Stock";
export type AlertSeverity = "Low" | "Medium" | "High";
export type AlertStatus = "Unread" | "Read" | "Dismissed";

export interface IAlert extends Document {
  type: AlertType;
  relatedBatchId?: Types.ObjectId;
  relatedIngredientId: Types.ObjectId;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  recommendedAction?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    type: {
      type: String,
      required: true,
      enum: ["Expiring Soon", "Critical", "Expired", "Low Stock"],
    },
    relatedBatchId: { type: Schema.Types.ObjectId, ref: "InventoryBatch" },
    relatedIngredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ["Low", "Medium", "High"] },
    status: {
      type: String,
      required: true,
      enum: ["Unread", "Read", "Dismissed"],
      default: "Unread",
    },
    recommendedAction: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IAlert>("Alert", alertSchema);
