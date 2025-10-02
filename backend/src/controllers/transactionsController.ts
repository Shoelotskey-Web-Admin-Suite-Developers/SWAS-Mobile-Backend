import { Request, Response } from "express";
import { Transaction } from "../models/Transactions";

// GET /api/transactions/:id
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne({ transaction_id: id });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    return res.json({ transaction });
  } catch (err) {
    console.error("Error fetching transaction:", err);
    return res.status(500).json({ message: "Server error" });
  }
};