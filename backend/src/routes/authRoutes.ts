import { Router } from "express";
import { createCustomer, getCustomerById, getCustomerFirstName, getCustomers, loginCustomer } from "../controllers/authController";
import { authenticate } from "../controllers/authToken";

const router = Router();

// Public routes
router.post("/customers", createCustomer);
router.post("/customers/login", loginCustomer);

// Public route for fetching first name (first word of cust_name)
router.get("/customers/:id/first-name", getCustomerFirstName);

// Protected routes
router.get("/customers/:id", authenticate, getCustomerById);
router.get("/customers", authenticate, getCustomers); // optional: admin-only

export default router;
