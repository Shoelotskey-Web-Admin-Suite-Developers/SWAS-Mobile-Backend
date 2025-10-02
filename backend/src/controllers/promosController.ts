import { Request, Response } from "express";
import { Branch } from "../models/Branch";
import { Promo } from "../models/Promo";

export const getAllPromos = async (req: Request, res: Response) => {
  try {
    const promos = await Promo.find().sort({ createdAt: -1 });

    const payload = await Promise.all(
      promos.map(async (p) => {
        let branchName = p.branch_id;
        if (p.branch_id === "SWAS-SUPERADMIN") branchName = "All Branches";
        else {
          try {
            const b = await Branch.findOne({ branch_id: p.branch_id });
            if (b && b.branch_name) branchName = b.branch_name;
          } catch (err) {}
        }

        return {
          id: p.promo_id,
          title: p.promo_title,
          description: p.promo_description || "",
          dates: p.promo_dates,
          duration: p.promo_duration,
          branch_id: p.branch_id,
          branch_name: branchName,
        };
      })
    );

    return res.json({ promos: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
