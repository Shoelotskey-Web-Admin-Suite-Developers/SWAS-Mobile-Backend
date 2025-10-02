// Example route setup
import express from "express";
import { getLineItemById, getLineItemsByCustomer } from "../controllers/lineItemController";

const router = express.Router();
router.get("/line-items/customer/:cust_id", getLineItemsByCustomer);
router.get("/line-items/:line_item_id", getLineItemById); // <-- Add this line

export default router;