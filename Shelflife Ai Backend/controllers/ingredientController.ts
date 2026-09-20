import type { Request, Response } from "express";
import Ingredient from "../models/Ingredient";

type AuthenticatedRequest = Request & { user?: any };

// POST /api/ingredients
const createIngredient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      brand,
      description,
      category,
      unitOfMeasure,
      minimumStock,
      standardUnitCost,
      defaultShelfLifeDays,
    } = req.body as {
      name?: string;
      brand?: string;
      description?: string;
      category?: string;
      unitOfMeasure?: string;
      minimumStock?: number;
      standardUnitCost?: number;
      defaultShelfLifeDays?: number;
    };

    if (
      !name ||
      !brand ||
      !description ||
      !category ||
      !unitOfMeasure ||
      minimumStock === undefined ||
      standardUnitCost === undefined ||
      defaultShelfLifeDays === undefined
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (minimumStock < 0 || standardUnitCost < 0 || defaultShelfLifeDays <= 0) {
      return res
        .status(400)
        .json({
          message:
            "Numeric fields must be valid (non-negative, shelf life > 0)",
        });
    }

    const ingredient = await Ingredient.create({
      name,
      brand,
      description,
      category,
      unitOfMeasure,
      minimumStock,
      standardUnitCost,
      defaultShelfLifeDays,
      createdBy: req.user?._id,
    });

    return res
      .status(201)
      .json({ message: "Ingredient created successfully", ingredient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// GET /api/ingredients
const getIngredients = async (_req: Request, res: Response) => {
  try {
    const ingredients = await Ingredient.find().sort({ createdAt: -1 });
    return res.status(200).json({ count: ingredients.length, ingredients });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// GET /api/ingredients/:id
const getIngredientById = async (req: Request, res: Response) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }
    return res.status(200).json({ ingredient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// PATCH /api/ingredients/:id
const updateIngredient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "name",
      "brand",
      "description",
      "category",
      "unitOfMeasure",
      "minimumStock",
      "standardUnitCost",
      "defaultShelfLifeDays",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const ingredient = await Ingredient.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }

    return res
      .status(200)
      .json({ message: "Ingredient updated successfully", ingredient });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// DELETE /api/ingredients/:id
const deleteIngredient = async (req: Request, res: Response) => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }
    return res.status(200).json({ message: "Ingredient deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export {
    createIngredient, deleteIngredient, getIngredientById, getIngredients, updateIngredient
};

