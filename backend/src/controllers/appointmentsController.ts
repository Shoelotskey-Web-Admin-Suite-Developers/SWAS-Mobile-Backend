// src/controllers/appointmentController.ts
import { Request, Response } from "express";
import { Appointment } from "../models/Appointments";

export const addAppointment = async (req: Request, res: Response) => {
  try {
    const { cust_id, branch_id, date_for_inquiry, time_start, time_end, status } = req.body;

    if (!cust_id || !branch_id || !date_for_inquiry || !time_start || !time_end) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for existing pending appointments from today onwards (not past appointments)
    const hasPendingFuture = await Appointment.findOne({ 
      cust_id, 
      status: "Pending",
      date_for_inquiry: { $gte: today }
    });
    if (hasPendingFuture) {
      return res.status(400).json({ error: "Customer already has a pending appointment today or in the future" });
    }

    // Check for existing approved appointments from today onwards
    const hasApprovedFuture = await Appointment.findOne({
      cust_id,
      status: "Approved",
      date_for_inquiry: { $gte: today },
    });
    if (hasApprovedFuture) {
      return res.status(400).json({ error: "Customer already has an approved appointment today or in the future" });
    }

    // Prevent re-booking an identical slot that was previously canceled by same customer (branch/date/time)
    const canceledSameSlot = await Appointment.findOne({
      cust_id,
      branch_id,
      date_for_inquiry: new Date(date_for_inquiry),
      time_start,
      status: "Canceled",
    });
    if (canceledSameSlot) {
      return res.status(400).json({
        error: "You have already canceled this exact timeslot. Please pick a different time or date.",
        code: "CANCELED_SLOT_REUSE",
      });
    }

    // Check if timeslot is already full (max 3 appointments per branch/day/timeslot)
    // Normalize the date to ensure consistent comparison (start of day)
    const targetDate = new Date(date_for_inquiry);
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existingAppointments = await Appointment.countDocuments({
      branch_id,
      date_for_inquiry: { 
        $gte: targetDate, 
        $lt: nextDay 
      },
      time_start,
      status: { $in: ["Pending", "Approved"] } // Count both pending and approved
    });

    console.log(`🔍 Timeslot check: branch=${branch_id}, date=${targetDate.toISOString().split('T')[0]}, time=${time_start}, existing=${existingAppointments}/3`);

    if (existingAppointments >= 3) {
      console.log(`❌ TIMESLOT FULL: Rejecting appointment for ${branch_id} on ${targetDate.toISOString().split('T')[0]} at ${time_start}`);
      return res.status(400).json({ 
        error: "This timeslot is already full. Please choose a different time or date." 
      });
    }

    console.log(`✅ TIMESLOT AVAILABLE: Proceeding with appointment creation`);
    

    // Auto-generate appointment_id
    const lastAppointment = await Appointment.findOne({}).sort({ _id: -1 }); // get last inserted
    const nextId = lastAppointment ? Number(lastAppointment.appointment_id.split("-")[1]) + 1 : 1;
    const appointment_id = `APPT-${nextId}`;

    const newAppointment = new Appointment({
      appointment_id,
      cust_id,
      branch_id,
      date_for_inquiry,
      time_start,
      time_end,
      status: status || "Pending",
    });

    await newAppointment.save();
    res.status(201).json(newAppointment);
  } catch (error) {
    console.error("Error adding appointment:", error);
    res.status(500).json({ error: "Failed to add appointment" });
  }
};

export const getLatestAppointmentByCustomer = async (req: Request, res: Response) => {
  try {
    const { cust_id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all future appointments excluding those strictly before today
    const futureAppointments = await Appointment.find({
      cust_id,
      date_for_inquiry: { $gte: today },
    })
      .sort({ date_for_inquiry: 1, time_start: 1 })
      .lean();

    if (!futureAppointments || futureAppointments.length === 0) {
      return res.status(404).json({ error: "No upcoming appointments found" });
    }

    // Priority: Pending first, then Approved. Exclude Canceled unless nothing else.
    const pending = futureAppointments.find(a => a.status === 'Pending');
    if (pending) return res.status(200).json(pending);

    const approved = futureAppointments.find(a => a.status === 'Approved');
    if (approved) return res.status(200).json(approved);

    // If only canceled remain, return 404 to treat as no active appointment
    return res.status(404).json({ error: "No upcoming appointments found" });
  } catch (error) {
    console.error("Error fetching latest appointment:", error);
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
};


export const deletePendingByCustomer = async (req: Request, res: Response) => {
  try {
    const { cust_id } = req.params;

    // Allow cancellation of both Pending and Approved appointments
    const deleted = await Appointment.deleteMany({ 
      cust_id, 
      status: { $in: ["Pending", "Approved"] } 
    });

    if (deleted.deletedCount === 0) {
      return res.status(404).json({ error: "No appointment found to cancel" });
    }

  res.status(200).json({ message: "Appointment(s) canceled successfully" });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

// Check if a user has previously canceled the exact same slot (branch/date/time)
export const checkCanceledSlot = async (req: Request, res: Response) => {
  try {
    const { cust_id, branch_id, date_for_inquiry, time_start } = req.query as Record<string,string>;
    if (!cust_id || !branch_id || !date_for_inquiry || !time_start) {
      return res.status(400).json({ error: "Missing required query params" });
    }
    const dateObj = new Date(date_for_inquiry);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid date_for_inquiry" });
    }
    const existing = await Appointment.findOne({
      cust_id,
      branch_id,
      date_for_inquiry: dateObj,
      time_start,
      status: "Canceled",
    });
    if (existing) {
      return res.status(200).json({ blocked: true, reason: "Previously canceled slot" });
    }
    return res.status(200).json({ blocked: false });
  } catch (err) {
    console.error("Error checking canceled slot:", err);
    return res.status(500).json({ error: "Failed to check canceled slot" });
  }
};

// Hard delete a single appointment by its appointment_id (scoped to customer for safety)
export const deleteAppointmentById = async (req: Request, res: Response) => {
  try {
    const { appointment_id, cust_id } = req.params;
    if (!appointment_id) {
      return res.status(400).json({ error: "Missing appointment_id" });
    }
    const query: any = { appointment_id };
    if (cust_id) query.cust_id = cust_id; // optional scoping
    const deleted = await Appointment.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    return res.status(200).json({ message: "Appointment deleted", appointment_id });
  } catch (err) {
    console.error("Error deleting appointment by id:", err);
    return res.status(500).json({ error: "Failed to delete appointment" });
  }
};

// Soft cancel (set status = Canceled) for a single appointment
export const cancelAppointmentById = async (req: Request, res: Response) => {
  try {
    const { appointment_id } = req.params;
    if (!appointment_id) {
      return res.status(400).json({ error: "Missing appointment_id" });
    }
    const appt = await Appointment.findOneAndUpdate(
      { appointment_id },
      { $set: { status: "Canceled" } },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    return res.status(200).json({ message: "Appointment canceled", appointment: appt });
  } catch (err) {
    console.error("Error canceling appointment by id:", err);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }
};
