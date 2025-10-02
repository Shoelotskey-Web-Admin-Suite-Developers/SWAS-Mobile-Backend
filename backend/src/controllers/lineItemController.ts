import { Request, Response } from "express";
import { LineItem } from "../models/LineItem";

// GET /line-items/customer/:cust_id
export const getLineItemsByCustomer = async (req: Request, res: Response) => {
  const { cust_id } = req.params;
  try {
    const lineItems = await LineItem.find({ cust_id });
    res.json(lineItems);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch line items." });
  }
};

// GET /line-items/:line_item_id
export const getLineItemById = async (req: Request, res: Response) => {
  const { line_item_id } = req.params;
  try {
    const lineItem = await LineItem.findOne({ line_item_id });
    if (!lineItem) {
      return res.status(404).json({ error: "Line item not found." });
    }
    res.json(lineItem);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch line item." });
  }
};