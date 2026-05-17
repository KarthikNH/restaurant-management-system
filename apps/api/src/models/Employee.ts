import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true }, // Manager, Chef, Server, Cleaner
    phone: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
    dateOfJoining: { type: Date, default: Date.now, required: true },
    baseSalary: { type: Number, required: true }, // Base monthly salary (in INR)
  },
  { timestamps: true },
);

export type EmployeeDoc = mongoose.InferSchemaType<typeof employeeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Employee =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
