import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: String, required: true }, // e.g. "2026-05"
    baseSalaryPaid: { type: Number, required: true },
    bonus: { type: Number, default: 0, required: true },
    deductions: { type: Number, default: 0, required: true },
    netPaid: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid"], default: "pending", required: true },
    paymentDate: { type: Date },
  },
  { timestamps: true },
);

export type PayrollDoc = mongoose.InferSchemaType<typeof payrollSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Payroll =
  mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);
