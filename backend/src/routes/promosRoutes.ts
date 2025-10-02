import { Router } from "express";
import { getAllPromos } from "../controllers/promosController";

const router = Router();

router.get("/", getAllPromos);

export default router;
