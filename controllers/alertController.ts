import { Request, Response } from "express";
import Alert from "../models/Alert";
import InventoryBatch from "../models/InventoryBatch";
import Ingredient from "../models/Ingredient";
import calculateBatchStatus from "../utils/calculateBatchStatus";

export const runAlertCheck = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const createdAlerts = [];

    const batches = await InventoryBatch.find().populate("ingredientId", "name minimumStock");

    for (const batch of batches) {
      const currentStatus = calculateBatchStatus(batch.expirationDate);

      if (batch.status !== currentStatus) {
        batch.status = currentStatus;
        await batch.save();
      }

      let alertType: "Expiring Soon" | "Critical" | "Expired" | null = null;
      let severity: "Medium" | "High" | null = null;

      if (currentStatus === "Expired") {
        alertType = "Expired";
        severity = "High";
      } else if (currentStatus === "Critical") {
        alertType = "Critical";
        severity = "High";
      } else if (currentStatus === "Approaching Expiry") {
        alertType = "Expiring Soon";
        severity = "Medium";
      }

      if (alertType) {
        const ingredient = batch.ingredientId as any;

        const existing = await Alert.findOne({
          relatedBatchId: batch._id,
          type: alertType,
          status: { $ne: "Dismissed" },
        });

        if (!existing) {
          const alert = await Alert.create({
            type: alertType,
            relatedBatchId: batch._id,
            relatedIngredientId: ingredient._id,
            message: `Batch ${batch.batchCode} of ${ingredient.name} is ${currentStatus.toLowerCase()} (expires ${new Date(batch.expirationDate).toDateString()})`,
            severity,
            recommendedAction:
              alertType === "Expired"
                ? "Remove from inventory and record as waste"
                : "Prioritize this batch for use (FEFO)",
          });
          createdAlerts.push(alert);
        }
      }
    }

    const ingredients = await Ingredient.find();

    for (const ingredient of ingredients) {
      const batchesForIngredient = await InventoryBatch.find({ ingredientId: ingredient._id });
      const totalQuantity = batchesForIngredient.reduce((sum, b) => sum + b.quantity, 0);

      if (totalQuantity < ingredient.minimumStock) {
        const existing = await Alert.findOne({
          relatedIngredientId: ingredient._id,
          type: "Low Stock",
          status: { $ne: "Dismissed" },
        });

        if (!existing) {
          const alert = await Alert.create({
            type: "Low Stock",
            relatedIngredientId: ingredient._id,
            message: `${ingredient.name} is below minimum stock (${totalQuantity} ${ingredient.unitOfMeasure} left, minimum is ${ingredient.minimumStock})`,
            severity: "Medium",
            recommendedAction: "Reorder from supplier",
          });
          createdAlerts.push(alert);
        }
      }
    }

    return res.status(200).json({
      message: `Alert check complete. ${createdAlerts.length} new alert(s) created.`,
      newAlerts: createdAlerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getAlerts = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const alerts = await Alert.find()
      .populate("relatedIngredientId", "name category")
      .populate("relatedBatchId", "batchCode expirationDate")
      .sort({ createdAt: -1 });
    return res.status(200).json({ count: alerts.length, alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status: "Read" }, { new: true });
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    return res.status(200).json({ message: "Alert marked as read", alert });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const dismissAlert = async (req: Request, res: Response): Promise<Response> => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: "Dismissed", resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }
    return res.status(200).json({ message: "Alert dismissed", alert });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
