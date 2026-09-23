import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  createUsageRecord,
  getUsageRecords,
  getUsageRecordById,
} from "../controllers/usageRecordController";

const router = express.Router();

router.use(authenticate);

router.get("/", getUsageRecords);
router.get("/:id", getUsageRecordById);
router.post(
  "/",
  authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"),
  createUsageRecord
);

export default router;
