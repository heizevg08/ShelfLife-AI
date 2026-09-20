const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");
const {
  getRoles,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserActiveStatus,
  deleteUser,
} = require("../controllers/userController");

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

module.exports = router;