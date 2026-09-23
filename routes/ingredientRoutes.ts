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

router.get("/", getIngredients);
router.get("/:id", getIngredientById);

router.post("/", authorize("Super Admin", "Admin", "Inventory Manager"), createIngredient);
router.patch("/:id", authorize("Super Admin", "Admin", "Inventory Manager"), updateIngredient);
router.delete("/:id", authorize("Super Admin", "Admin"), deleteIngredient);

export default router;
