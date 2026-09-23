import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
} from "../controllers/inventoryBatchController";

const router = express.Router();

router.use(authenticate);

router.get("/", getBatches);
router.get("/:id", getBatchById);

router.post("/", authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"), createBatch);
router.patch("/:id", authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"), updateBatch);
router.delete("/:id", authorize("Super Admin", "Admin", "Inventory Manager"), deleteBatch);

export default router;
