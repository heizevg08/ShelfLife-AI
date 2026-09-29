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
router.get("/", authorize("Admin", "Inventory Manager", "Inventory Staff"), getBatches);
router.get("/:id", authorize("Admin", "Inventory Manager", "Inventory Staff"), getBatchById);

router.post("/", authorize("Admin", "Inventory Manager", "Inventory Staff"), createBatch);
router.patch("/:id", authorize("Admin", "Inventory Manager", "Inventory Staff"), updateBatch);
router.delete("/:id", authorize("Admin", "Inventory Manager"), deleteBatch);

export default router;
