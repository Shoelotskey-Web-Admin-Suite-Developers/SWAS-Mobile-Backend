import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";

import announcementsRoute from "./routes/announcementsRoutes";
import appointmentsRoute from "./routes/appointmentsRoute";
import customerRoutes from "./routes/authRoutes";
import branchRoute from "./routes/branchRoutes";
import datesRoutes from "./routes/datesRoutes";
import lineItemRoutes from "./routes/lineItemRoutes"; // Adjust path if needed
import notifTokenRoute from "./routes/notifTokenRoutes";
import promosRoute from "./routes/promosRoutes";
import serviceRoutes from "./routes/servicesRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import unavailabilityRoutes from "./routes/unavailabilityRoutes";
import { initSocket } from "./socket"; // your socket logic with change streams

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ Setup Socket.IO
const io = new Server(server, {
  cors: { origin: "*" },
});

// Middleware
app.use(express.json());

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("🚀 API is running...");
});

// Mount routes
app.use("/api", customerRoutes);
app.use("/api/notif-token", notifTokenRoute);
app.use("/api/unavailability", unavailabilityRoutes);
app.use("/api/appointments", appointmentsRoute);
app.use("/api/branches", branchRoute);
app.use("/api/announcements", announcementsRoute);
app.use("/api/promos", promosRoute);
app.use("/api", lineItemRoutes); // Use the line item routes
app.use("/api/services", serviceRoutes); // <-- Add this line
app.use("/api", transactionRoutes);
app.use("/api/dates", datesRoutes);

// ✅ Connect to MongoDB and initialize sockets
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/swas";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    initSocket(io, mongoose.connection); // pass both Socket.IO and DB connection
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
