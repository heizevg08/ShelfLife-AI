import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ MongoDB connection failed: ${message}`);
    process.exit(1); // stop the app if DB connection fails — nothing works without it
  }
};

export default connectDB;
