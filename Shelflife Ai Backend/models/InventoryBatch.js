const mongoose = require("mongoose");

const inventoryBatchSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
    batchCode: { type: String, required: true },
    initialQuantity: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    dateReceived: { type: Date, required: true },
    expirationDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          // expirationDate must be after dateReceived
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryBatch", inventoryBatchSchema);