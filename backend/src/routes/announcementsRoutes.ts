import { Router } from "express";
import { getAllAnnouncements } from "../controllers/announcementsController";

const router = Router();

// GET /api/announcements
router.get("/", getAllAnnouncements);

export default router;
