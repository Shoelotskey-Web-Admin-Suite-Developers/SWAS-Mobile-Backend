// Example route setup
import express from "express";
import { getServiceById } from "../controllers/ServiceController";

const router = express.Router();

router.get("/:service_id", getServiceById);

export default router;