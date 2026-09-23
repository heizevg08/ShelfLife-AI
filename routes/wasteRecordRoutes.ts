import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  createWasteRecord,
  getWasteRecords,
  getWasteRecordById,
} from "../controllers/wasteRecordController";

const router = express.Router();

router.use(authenticate);

router.get("/", getWasteRecords);
router.get("/:id", getWasteRecordById);
router.post(
  "/",
  authorize("Super Admin", "Admin", "Inventory Manager", "Inventory Staff"),
  createWasteRecord
);

export default router;
