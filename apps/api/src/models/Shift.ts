import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    shiftType: { type: String, enum: ["morning", "evening", "night"], required: true },
    startTime: { type: String, required: true }, // e.g. "08:00 AM"
    endTime: { type: String, required: true }, // e.g. "04:00 PM"
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type ShiftDoc = mongoose.InferSchemaType<typeof shiftSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Shift =
  mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
