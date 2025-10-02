// src/routes/branchRoutes.ts
import express from "express";
import { getBranchById, getBranchesOfTypeB } from "../controllers/branchController";

const router = express.Router();

// GET all branches of type B
router.get("/b", getBranchesOfTypeB);

// GET branch by ID
router.get("/:id", getBranchById);

export default router;
