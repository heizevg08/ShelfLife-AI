const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
} = require("../controllers/inventoryBatchController");

router.use(authenticate);

router.get("/", getBatches);
router.get("/:id", getBatchById);

router.post("/", authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"), createBatch);
router.patch("/:id", authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"), updateBatch);
router.delete("/:id", authorize("Super Admin", "Admin", "Inventory Manager"), deleteBatch);

module.exports = router;