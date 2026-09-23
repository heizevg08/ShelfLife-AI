import { Request, Response } from "express";
import InventoryBatch from "../models/InventoryBatch";
import Ingredient from "../models/Ingredient";
import calculateBatchStatus from "../utils/calculateBatchStatus";

interface CreateBatchBody {
  ingredientId: string;
  batchCode: string;
  initialQuantity: number;
  unit: string;
  dateReceived: string;
  expirationDate: string;
  unitCost: number;
}

export const createBatch = async (req: Request<{}, {}, CreateBatchBody>, res: Response): Promise<Response> => {
  try {
    const { ingredientId, batchCode, initialQuantity, unit, dateReceived, expirationDate, unitCost } = req.body;

    if (!ingredientId || !batchCode || !initialQuantity || !unit || !dateReceived || !expirationDate || unitCost === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }

    if (new Date(expirationDate) <= new Date(dateReceived)) {
      return res.status(400).json({ message: "expirationDate must be after dateReceived" });
    }

    if (initialQuantity <= 0 || unitCost < 0) {
      return res.status(400).json({ message: "initialQuantity must be > 0 and unitCost must be >= 0" });
    }

    const status = calculateBatchStatus(expirationDate);

    const batch = await InventoryBatch.create({
      ingredientId,
      batchCode,
      initialQuantity,
      quantity: initialQuantity,
      unit,
      dateReceived,
      expirationDate,
      unitCost,
      status,
      createdBy: req.user?.id,
    });

    return res.status(201).json({ message: "Batch created successfully", batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getBatches = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const batches = await InventoryBatch.find()
      .populate("ingredientId", "name category unitOfMeasure")
      .sort({ expirationDate: 1 });
    return res.status(200).json({ count: batches.length, batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getBatchById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const batch = await InventoryBatch.findById(req.params.id).populate(
      "ingredientId",
      "name category unitOfMeasure"
    );
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

interface UpdateBatchBody {
  batchCode?: string;
  quantity?: number;
  unit?: string;
  expirationDate?: string;
  unitCost?: number;
}

export const updateBatch = async (req: Request<{ id: string }, {}, UpdateBatchBody>, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { batchCode, quantity, unit, expirationDate, unitCost } = req.body;

    const batch = await InventoryBatch.findById(id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (batchCode) batch.batchCode = batchCode;
    if (unit) batch.unit = unit;
    if (unitCost !== undefined) batch.unitCost = unitCost;
    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({ message: "quantity cannot be negative" });
      }
      batch.quantity = quantity;
    }
    if (expirationDate) {
      if (new Date(expirationDate) <= new Date(batch.dateReceived)) {
        return res.status(400).json({ message: "expirationDate must be after dateReceived" });
      }
      batch.expirationDate = new Date(expirationDate);
    }

    batch.status = calculateBatchStatus(batch.expirationDate);

    await batch.save();

    return res.status(200).json({ message: "Batch updated successfully", batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const deleteBatch = async (req: Request, res: Response): Promise<Response> => {
  try {
    const batch = await InventoryBatch.findByIdAndDelete(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    return res.status(200).json({ message: "Batch deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
