import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
