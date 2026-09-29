import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import bcrypt from "bcryptjs";
import connectDB from "./config/Database";
import User, { UserRole } from "./models/User";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import ingredientRoutes from "./routes/ingredientRoutes";
import inventoryBatchRoutes from "./routes/inventoryBatchRoutes";
import usageRecordRoutes from "./routes/usageRecordRoutes";
import wasteRecordRoutes from "./routes/wasteRecordRoutes";
import alertRoutes from "./routes/alertRoutes";

const app = express();

// --- Connect to MongoDB, then seed default data ---
connectDB().then(() => seedDefaults());

interface DefaultAccount {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
}

// Creates a default account for each role on first run, if it doesn't exist yet.
const defaultAccounts: DefaultAccount[] = [
  { firstName: "Super", lastName: "Admin", email: "superadmin@shelflife.com", password: "superadmin1234", role: "Super Admin" },
  { firstName: "Admin", lastName: "User", email: "admin@shelflife.com", password: "admin1234", role: "Admin" },
  { firstName: "Inventory", lastName: "Manager", email: "manager@shelflife.com", password: "manager1234", role: "Inventory Manager" },
  { firstName: "Inventory", lastName: "Staff", email: "staff@shelflife.com", password: "inventorystaff1234", role: "Inventory Staff" },
];

async function seedDefaults(): Promise<void> {
  try {
    for (const account of defaultAccounts) {
      const existing = await User.findOne({ email: account.email });
      if (!existing) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(account.password, salt);
        await User.create({
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          role: account.role,
          passwordHash,
          isActive: true,
        });
        console.log(`✅ Default ${account.role} seeded: ${account.email} / ${account.password}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Seeding error:", message);
  }
}

// --- Core middleware ---
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Strips any keys starting with "$" or containing "." from req.body, req.query,
// and req.params — blocks NoSQL injection attempts like { "$gt": "" } before
// they ever reach a Mongoose query.
app.use(
  mongoSanitize({
    onSanitize: ({ key }) => {
      console.warn(`⚠️  Sanitized a potentially malicious key: ${key}`);
    },
  })
);

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "OK", message: "ShelfLife AI API is running" });
});

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/inventory-batches", inventoryBatchRoutes);
app.use("/api/usage-records", usageRecordRoutes);
app.use("/api/waste-records", wasteRecordRoutes);
app.use("/api/alerts", alertRoutes);
// Next up as your team builds them out:
// app.use("/api/forecasts", forecastRoutes);

// --- Basic error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
