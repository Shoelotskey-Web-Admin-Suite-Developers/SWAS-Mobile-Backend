// src/routes/unavailabilityRoutes.ts
import express from "express";
import { getUnavailabilityByDate } from "../controllers/unavailabilityController";

const router = express.Router();

router.get("/", getUnavailabilityByDate);

export default router;
