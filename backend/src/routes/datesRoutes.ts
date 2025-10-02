import { Router } from "express";
import { getDatesByLineItemId } from "../controllers/datesController";

const router = Router();

router.get("/:line_item_id", getDatesByLineItemId);

export default router;