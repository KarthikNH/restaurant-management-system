import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ["present", "absent", "leave"], required: true },
    checkInTime: { type: String, default: "" }, // e.g. "09:00 AM"
    checkOutTime: { type: String, default: "" }, // e.g. "06:00 PM"
  },
  { timestamps: true },
);

export type AttendanceDoc = mongoose.InferSchemaType<typeof attendanceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
