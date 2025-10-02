import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Customer } from "../models/Customer";

interface AuthRequest extends Request {
  user?: any;
}

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { cust_name, cust_bdate, cust_address, cust_contact, cust_email } = req.body;

    if (!cust_name || !cust_bdate) {
      return res.status(400).json({ error: "Name and birthdate are required" });
    }

    if (!cust_address || !cust_address.toString().trim()) {
      return res.status(400).json({ error: "Address is required" });
    }

    // ✅ Check if a customer with the same name and birthdate already exists
    const existingCustomer = await Customer.findOne({
      cust_name: cust_name.trim(),
      cust_bdate: new Date(cust_bdate),
    });

    if (existingCustomer) {
      return res.status(409).json({ 
        error: "A customer with the same name and birthdate already exists." 
      });
    }

    // Note: we no longer enforce email uniqueness. Multiple customers may share the same email.

    // Generate cust_id with simple fixed prefix (no regex / legacy scan): CUST-0-<n>
    const prefix = "CUST-0-";
    const allIds = await Customer.find({}, { cust_id: 1, _id: 0 }).lean();
    let maxSeq = 0;
    for (const rec of allIds) {
      if (rec.cust_id && rec.cust_id.startsWith(prefix)) {
        const n = parseInt(rec.cust_id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
    }
    const nextNumber = String(maxSeq + 1);

    const customer = new Customer({
      cust_id: prefix + nextNumber,
      cust_name: cust_name.trim(),
      cust_bdate: cust_bdate,
      cust_address: cust_address,
      cust_contact: cust_contact || null,
      cust_email: cust_email || null,
      total_services: 0,
      total_expenditure: 0,
    });

    await customer.save();
    return res.status(201).json({ message: "Customer created successfully", customer });

  } catch (err: any) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ error: `Duplicate value found for '${field}': ${err.keyValue[field]}` });
    }
    return res.status(400).json({ error: err.message });
  }
};


// Login Customer → returns JWT
export const loginCustomer = async (req: Request, res: Response) => {
  const { firstName, lastName, cust_bdate } = req.body;

  if (!firstName || !lastName || !cust_bdate) {
    return res.status(400).json({ error: "Missing first name, last name, or birthdate" });
  }

  try {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const date = new Date(cust_bdate);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const customer = await Customer.findOne({
      cust_name: fullName,
      cust_bdate: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!customer) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
  { cust_id: customer.cust_id, cust_name: customer.cust_name },
  process.env.JWT_SECRET!,
  { expiresIn: "2h" }
);

  // 👇 return both token and cust_id
  return res.json({ 
    message: "Login successful", 
    token,
    userId: customer.cust_id   // <-- add this
  });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Get all customers → admin-only (optional)
export const getCustomers = async (req: AuthRequest, res: Response) => {
  // Example: you can enforce admin role if needed
  // if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  try {
    const customers = await Customer.find();
    return res.json({ customers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Get a single customer → user can only access their own data
export const getCustomerById = async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findOne({ cust_id: req.params.id });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // Only allow access if cust_id matches the token
    if (req.user?.cust_id !== customer.cust_id) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    return res.json({ customer });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// Get customer's first name (first word of cust_name)
export const getCustomerFirstName = async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findOne({ cust_id: req.params.id });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // If a token is present, ensure requester owns the profile.
    // If no token is provided, allow public access to the first name only.
    if (req.user && req.user?.cust_id !== customer.cust_id) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    const fullName = (customer.cust_name || "").trim();
    const firstName = fullName.split(/\s+/)[0] || "";

    return res.json({ firstName });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
