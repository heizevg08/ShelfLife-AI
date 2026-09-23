import mongoose, { Document, Schema, Types } from "mongoose";

export type BatchStatus = "Normal" | "Approaching Expiry" | "Critical" | "Expired";

export interface IInventoryBatch extends Document {
  ingredientId: Types.ObjectId;
  batchCode: string;
  initialQuantity: number;
  quantity: number;
  unit: string;
  dateReceived: Date;
  expirationDate: Date;
  unitCost: number;
  status: BatchStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryBatchSchema = new Schema<IInventoryBatch>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    batchCode: { type: String, required: true },
    initialQuantity: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    dateReceived: { type: Date, required: true },
    expirationDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: IInventoryBatch, value: Date) {
          return value > this.dateReceived;
        },
        message: "expirationDate must be after dateReceived",
      },
    },
    unitCost: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["Normal", "Approaching Expiry", "Critical", "Expired"],
      default: "Normal",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IInventoryBatch>("InventoryBatch", inventoryBatchSchema);
