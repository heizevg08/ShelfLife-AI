import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User, { UserRole } from "../models/User";

const VALID_ROLES: UserRole[] = ["Super Admin", "Admin", "Inventory Manager", "Inventory Staff"];

export const getRoles = async (_req: Request, res: Response): Promise<Response> => {
  return res.status(200).json({ roles: VALID_ROLES });
};

export const getUsers = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    return res.status(200).json({ count: users.length, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export const createUser = async (req: Request<{}, {}, CreateUserBody>, res: Response): Promise<Response> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, role, passwordHash });

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: UserRole;
}

export const updateUser = async (req: Request<{ id: string }, {}, UpdateUserBody>, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (req.user && req.user.id === id && role && role !== req.user.role) {
      return res.status(403).json({ message: "You cannot change your own role" });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const updates: UpdateUserBody = {};
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const toggleUserActiveStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      return res.status(403).json({ message: "You cannot deactivate your own account" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      return res.status(403).json({ message: "You cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message: "Server error", error: message });
  }
};
