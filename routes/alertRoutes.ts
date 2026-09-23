import express from "express";
import { authenticate } from "../middleware/authMiddleware";
import { runAlertCheck, getAlerts, markAsRead, dismissAlert } from "../controllers/alertController";

const router = express.Router();

router.use(authenticate);

router.get("/", getAlerts);
router.post("/check", runAlertCheck);
router.patch("/:id/read", markAsRead);
router.patch("/:id/dismiss", dismissAlert);

export default router;
