import { Request, Response } from "express";
import { NotifToken } from "../models/NotifToken";

export const addPushToken = async (req: Request, res: Response) => {
  try {
    const { cust_id, token } = req.body;

    if (!cust_id || !token) {
      return res.status(400).json({ error: "cust_id and token are required" });
    }

    // Prevent duplicates
    const existing = await NotifToken.findOne({ cust_id, token });
    if (existing) {
      return res.status(200).json({ message: "Push token already registered", data: existing });
    }

    const newToken = await NotifToken.create({ cust_id, token });
    return res.status(201).json({ message: "Push token saved", data: newToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * DELETE /api/notif-token/:cust_id/:token
 * Remove a push token for a specific user
 */
export const deletePushToken = async (req: Request, res: Response) => {
  try {
    const { cust_id, token } = req.params;

    if (!cust_id || !token) {
      return res.status(400).json({ error: "cust_id and token are required" });
    }

    const deleted = await NotifToken.findOneAndDelete({ cust_id, token });

    if (!deleted) {
      return res.status(404).json({ message: "Push token not found" });
    }

    return res.status(200).json({ message: "Push token deleted", data: deleted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};
