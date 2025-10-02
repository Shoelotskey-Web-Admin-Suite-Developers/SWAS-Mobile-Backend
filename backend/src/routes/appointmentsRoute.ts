// src/routes/appointmentsRoute.ts
import express from "express";
import {
    addAppointment,
    cancelAppointmentById,
    checkCanceledSlot,
    deleteAppointmentById,
    deletePendingByCustomer,
    getLatestAppointmentByCustomer,
} from "../controllers/appointmentsController";

const router = express.Router();

// ✅ Add a new appointment
router.post("/", addAppointment);

// ✅ Get all appointments for a specific customer
router.get("/customer/:cust_id", getLatestAppointmentByCustomer);

// ✅ Delete pending appointments for a specific customer
router.delete("/customer/:cust_id/pending", deletePendingByCustomer);

// ✅ Check if a canceled slot blocks reuse
router.get("/canceled/check", checkCanceledSlot);

// ✅ Delete a single appointment by id (optional cust scope)
router.delete("/:appointment_id", deleteAppointmentById); // optionally add /customer/:cust_id/:appointment_id if stricter needed
// ✅ Soft cancel an appointment
router.patch("/:appointment_id/cancel", cancelAppointmentById);

export default router;
