import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "Super Admin" | "Admin" | "Inventory Manager" | "Inventory Staff";

export interface IUser extends Document {
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    role: {
      type: String,
      required: true,
      enum: ["Super Admin", "Admin", "Inventory Manager", "Inventory Staff"],
    },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
