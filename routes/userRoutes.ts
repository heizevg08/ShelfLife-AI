import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware";
import {
  getRoles,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserActiveStatus,
  deleteUser,
} from "../controllers/userController";

const router = express.Router();

// Public — no login required, used for signup/role dropdowns
router.get("/roles", getRoles);

// Every route below requires: (1) a valid logged-in session, (2) Super Admin role
router.use(authenticate, authorize("Super Admin"));

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.patch("/:id/deactivate", toggleUserActiveStatus);
router.delete("/:id", deleteUser);

export default router;
