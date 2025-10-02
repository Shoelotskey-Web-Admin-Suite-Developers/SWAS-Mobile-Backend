// src/controllers/branchController.ts
import { Request, Response } from "express";
import { Branch } from "../models/Branch";

export const getBranchesOfTypeB = async (req: Request, res: Response) => {
  try {
    // Find all branches where type is "B"
    const branches = await Branch.find({ type: "B" }).sort({ branch_number: 1 }); // optional: sort by branch_number

    if (!branches.length) {
      return res.status(404).json({ error: "No branches of type B found" });
    }

    res.status(200).json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
};

// New function to get branch by ID
export const getBranchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findOne({ branch_id: id });

    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    res.status(200).json(branch);
  } catch (error) {
    console.error("Error fetching branch:", error);
    res.status(500).json({ error: "Failed to fetch branch" });
  }
};
