import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import User from "../models/User";

type AuthenticatedRequest = Request & { user?: any };

// GET /api/users/roles
// Returns the list of valid roles — public, used for dropdowns etc.
const getRoles = async (_req: Request, res: Response) => {
  const roles = [
    "Super Admin",
    "Admin",
    "Inventory Manager",
    "Inventory Staff",
  ];
  return res.status(200).json({ roles });
};

// GET /api/users
// List all users — Super Admin only
const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    return res.status(200).json({ count: users.length, users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// GET /api/users/:id
// View a single user's details — Super Admin only
const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// POST /api/users
// Super Admin creates a new account directly, assigning a role
const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const validRoles = [
      "Super Admin",
      "Admin",
      "Inventory Manager",
      "Inventory Staff",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = (await (User as any).create({
      name,
      email,
      role,
      passwordHash,
    })) as any;

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// PATCH /api/users/:id
// Update a user's name, email, or role — Super Admin only
const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body as {
      name?: string;
      email?: string;
      role?: string;
    };

    if (req.user?._id?.toString() === id && role && role !== req.user.role) {
      return res
        .status(403)
        .json({ message: "You cannot change your own role" });
    }

    const validRoles = [
      "Super Admin",
      "Admin",
      "Inventory Manager",
      "Inventory Staff",
    ];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;

    const user = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User updated successfully", user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// PATCH /api/users/:id/deactivate
// Toggle isActive — disables login without deleting the account
const toggleUserActiveStatus = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (req.user?._id?.toString() === id) {
      return res
        .status(403)
        .json({ message: "You cannot deactivate your own account" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

// DELETE /api/users/:id
// Permanently removes a user — Super Admin only. Prefer deactivate for normal use;
// this is for genuine mistakes (e.g. duplicate/test accounts), not routine offboarding.
const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?._id?.toString() === id) {
      return res
        .status(403)
        .json({ message: "You cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export {
    createUser,
    deleteUser,
    getRoles,
    getUserById,
    getUsers,
    toggleUserActiveStatus,
    updateUser
};

