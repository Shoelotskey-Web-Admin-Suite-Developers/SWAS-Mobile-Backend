import { Request, Response } from "express";
import { Service } from "../models/Services";

// GET /services/:service_id
export const getServiceById = async (req: Request, res: Response) => {
  try {
    const { service_id } = req.params;
    const service = await Service.findOne({ service_id });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    return res.json(service);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};