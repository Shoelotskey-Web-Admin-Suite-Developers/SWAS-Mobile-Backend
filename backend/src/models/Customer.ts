// src/models/Customer.ts
import mongoose, { Document, Schema } from "mongoose";

export interface ICustomer extends Document {
  cust_id: string; /*CUST-01-00001 */
  cust_name: string;
  cust_bdate?: Date;
  cust_address?: string;
  cust_email?: string;
  cust_contact?: string;
  total_services: number;
  total_expenditure: number;
}

const CustomerSchema: Schema<ICustomer> = new Schema<ICustomer>(
  {
    cust_id: { type: String, required: true, unique: true },
    cust_name: { type: String, required: true },
  cust_bdate: { type: Date, default: null },
  cust_address: { type: String, required: true },
    cust_email: { type: String, default: null },
    cust_contact: { type: String, default: null },
    total_services: { type: Number, default: 0 },
    total_expenditure: { type: Number, default: 0.0 },
  },
  { timestamps: true }
);

// Partial index for emails — ensures uniqueness only for non-null values
// Note: cust_email is intentionally not unique now; allow multiple customers to share the same email.

// Explicit collection name
export const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema, "customers");
