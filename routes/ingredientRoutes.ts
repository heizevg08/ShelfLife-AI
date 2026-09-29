import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient,
} from "../controllers/ingredientController";

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("Admin", "Inventory Manager", "Inventory Staff"), getIngredients);
router.get("/:id", authorize("Admin", "Inventory Manager", "Inventory Staff"), getIngredientById);

router.post("/", authorize("Admin", "Inventory Manager"), createIngredient);
router.patch("/:id", authorize("Admin", "Inventory Manager"), updateIngredient);
router.delete("/:id", authorize("Admin"), deleteIngredient);

export default router;
