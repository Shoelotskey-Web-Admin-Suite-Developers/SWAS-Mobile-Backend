import express from "express";
import { addPushToken, deletePushToken } from "../controllers/notifTokenController";

const router = express.Router();

// POST /api/notif-token
router.post("/", addPushToken);

// DELETE /api/notif-token/:cust_id/:token
router.delete("/:cust_id/:token", deletePushToken);

export default router;
