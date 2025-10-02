import { Router } from "express";
import { getTransactionById } from "../controllers/transactionsController";

const router = Router();

// GET /api/transactions/:id
router.get("/transactions/:id", getTransactionById);

export default router;