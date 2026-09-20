const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient,
} = require("../controllers/ingredientController");

// All ingredient routes require login
router.use(authenticate);

router.get("/", getIngredients);
router.get("/:id", getIngredientById);

// Only these roles can create/edit/delete ingredients
router.post("/", authorize("Super Admin", "Admin", "Inventory Manager"), createIngredient);
router.patch("/:id", authorize("Super Admin", "Admin", "Inventory Manager"), updateIngredient);
router.delete("/:id", authorize("Super Admin", "Admin"), deleteIngredient);

module.exports = router;