import { Request, Response } from "express";
import { Dates } from "../models/Dates";

// GET /dates/:line_item_id
export const getDatesByLineItemId = async (req: Request, res: Response) => {
  try {
    const { line_item_id } = req.params;
    const dates = await Dates.findOne({ line_item_id });

    if (!dates) {
      return res.status(404).json({ message: "Dates not found" });
    }

    res.json(dates);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};