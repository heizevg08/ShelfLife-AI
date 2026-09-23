import { Request, Response } from "express";
import UsageRecord from "../models/UsageRecord";
import InventoryBatch from "../models/InventoryBatch";

interface CreateUsageRecordBody {
  batchId: string;
  quantityUsed: number;
  unit: string;
  dateUsed: string;
}

export const createUsageRecord = async (
  req: Request<{}, {}, CreateUsageRecordBody>,
  res: Response
): Promise<Response> => {
  try {
    const { batchId, quantityUsed, unit, dateUsed } = req.body;

    if (!batchId || !quantityUsed || !unit || !dateUsed) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (quantityUsed <= 0) {
      return res.status(400).json({ message: "quantityUsed must be greater than 0" });
    }

    const batch = await InventoryBatch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (quantityUsed > batch.quantity) {
      return res.status(400).json({
        message: `quantityUsed (${quantityUsed}) exceeds available batch quantity (${batch.quantity})`,
      });
    }

    const usageRecord = await UsageRecord.create({
      batchId,
      ingredientId: batch.ingredientId,
      quantityUsed,
      unit,
      dateUsed,
      staffId: req.user?.id,
    });

    batch.quantity -= quantityUsed;
    await batch.save();

    return res.status(201).json({
      message: "Usage recorded successfully",
      usageRecord,
      remainingBatchQuantity: batch.quantity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getUsageRecords = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const records = await UsageRecord.find()
      .populate("ingredientId", "name category")
      .populate("batchId", "batchCode")
      .populate("staffId", "name")
      .sort({ dateUsed: -1 });
    return res.status(200).json({ count: records.length, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getUsageRecordById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const record = await UsageRecord.findById(req.params.id)
      .populate("ingredientId", "name category")
      .populate("batchId", "batchCode")
      .populate("staffId", "name");
    if (!record) {
      return res.status(404).json({ message: "Usage record not found" });
    }
    return res.status(200).json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
