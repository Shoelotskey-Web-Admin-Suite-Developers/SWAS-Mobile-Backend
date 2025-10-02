// src/controllers/unavailabilityController.ts
import { Request, Response } from "express";
import { Unavailability } from "../models/Unavailability";

// ✅ Get unavailability by specific date (or range)
export const getUnavailabilityByDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date query parameter is required (YYYY-MM-DD)" });
    }

    const targetDate = new Date(date as string);

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Match records where the unavailable date matches the requested date
    // We check within the same day using a start/end range
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await Unavailability.find({
      date_unavailable: { $gte: startOfDay, $lte: endOfDay },
    });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching unavailability:", error);
    return res.status(500).json({ error: "Server error fetching unavailability records" });
  }
};
