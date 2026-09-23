import { Request, Response } from "express";
import WasteRecord from "../models/WasteRecord";
import InventoryBatch from "../models/InventoryBatch";
import calculateWasteCost from "../utils/calculateWasteCost";

interface CreateWasteRecordBody {
  batchId: string;
  quantityWasted: number;
  unit: string;
  reason: string;
  dateWasted: string;
  notes?: string;
}

export const createWasteRecord = async (
  req: Request<{}, {}, CreateWasteRecordBody>,
  res: Response
): Promise<Response> => {
  try {
    const { batchId, quantityWasted, unit, reason, dateWasted, notes } = req.body;

    if (!batchId || !quantityWasted || !unit || !reason || !dateWasted) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (quantityWasted <= 0) {
      return res.status(400).json({ message: "quantityWasted must be greater than 0" });
    }

    const batch = await InventoryBatch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (quantityWasted > batch.quantity) {
      return res.status(400).json({
        message: `quantityWasted (${quantityWasted}) exceeds available batch quantity (${batch.quantity})`,
      });
    }

    const wasteCost = calculateWasteCost(quantityWasted, batch.unitCost);

    const wasteRecord = await WasteRecord.create({
      batchId,
      ingredientId: batch.ingredientId,
      quantityWasted,
      unit,
      reason,
      wasteCost,
      dateWasted,
      recordedBy: req.user?.id,
      notes,
    });

    batch.quantity -= quantityWasted;
    await batch.save();

    return res.status(201).json({
      message: "Waste recorded successfully",
      wasteRecord,
      remainingBatchQuantity: batch.quantity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getWasteRecords = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const records = await WasteRecord.find()
      .populate("ingredientId", "name category")
      .populate("batchId", "batchCode")
      .populate("recordedBy", "name")
      .sort({ dateWasted: -1 });
    return res.status(200).json({ count: records.length, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getWasteRecordById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const record = await WasteRecord.findById(req.params.id)
      .populate("ingredientId", "name category")
      .populate("batchId", "batchCode")
      .populate("recordedBy", "name");
    if (!record) {
      return res.status(404).json({ message: "Waste record not found" });
    }
    return res.status(200).json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
