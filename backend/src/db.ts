import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config(); // Load .env variables

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("✅ MongoDB connected successfully");
  } catch (err: any) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;
