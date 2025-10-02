import { Request, Response } from "express";
import { Announcement } from "../models/Announcements";
import { Branch } from "../models/Branch";

// Return all announcements ordered by date desc
export const getAllAnnouncements = async (req: Request, res: Response) => {
  try {
    const announcements = await Announcement.find().sort({ announcement_date: -1 });

    // Map field names to a simpler shape for the client
    const payload = await Promise.all(
      announcements.map(async (a) => {
        let branchName = a.branch_id;

        // Special-case: SWAS-SUPERADMIN → All Branches
        if (a.branch_id === "SWAS-SUPERADMIN") {
          branchName = "All Branches";
        } else {
          try {
            const b = await Branch.findOne({ branch_id: a.branch_id });
            if (b && b.branch_name) branchName = b.branch_name;
          } catch (err) {
            // ignore and fall back to id
          }
        }

        return {
          id: a.announcement_id,
          title: a.announcement_title,
          description: a.announcement_description || "",
          date: a.announcement_date,
          branch_id: a.branch_id,
          branch_name: branchName,
        };
      })
    );

    return res.json({ announcements: payload });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
