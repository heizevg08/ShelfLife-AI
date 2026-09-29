import { Request, Response } from "express";
import Ingredient, { UnitOfMeasure } from "../models/Ingredient";

const VALID_UNITS: UnitOfMeasure[] = ["pcs", "kg", "g", "L", "ml", "boxes", "packs"];

interface CreateIngredientBody {
  name: string;
  brand: string;
  description: string;
  category: string;
  unitOfMeasure: UnitOfMeasure;
  minimumStock: number;
  standardUnitCost: number;
  defaultShelfLifeDays: number;
}

export const createIngredient = async (
  req: Request<{}, {}, CreateIngredientBody>,
  res: Response
): Promise<Response> => {
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
    } = req.body;

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
      return res.status(400).json({ message: "Numeric fields must be valid (non-negative, shelf life > 0)" });
    }

    if (!VALID_UNITS.includes(unitOfMeasure)) {
      return res.status(400).json({
        message: `Invalid unitOfMeasure. Must be one of: ${VALID_UNITS.join(", ")}`,
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
      createdBy: req.user?.id,
    });

    return res.status(201).json({ message: "Ingredient created successfully", ingredient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getIngredients = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const ingredients = await Ingredient.find().sort({ createdAt: -1 });
    return res.status(200).json({ count: ingredients.length, ingredients });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getIngredientById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }
    return res.status(200).json({ ingredient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

const ALLOWED_UPDATE_FIELDS = [
  "name",
  "brand",
  "description",
  "category",
  "unitOfMeasure",
  "minimumStock",
  "standardUnitCost",
  "defaultShelfLifeDays",
] as const;

export const updateIngredient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const ingredient = await Ingredient.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }

    return res.status(200).json({ message: "Ingredient updated successfully", ingredient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const deleteIngredient = async (req: Request, res: Response): Promise<Response> => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: "Ingredient not found" });
    }
    return res.status(200).json({ message: "Ingredient deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
