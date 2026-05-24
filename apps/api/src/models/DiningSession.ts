import mongoose from "mongoose";

const diningSessionSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    partySize: { type: Number, default: 0, min: 0, max: 200 },
  },
  { timestamps: true },
);

diningSessionSchema.index({ tableId: 1, status: 1 });
diningSessionSchema.index(
  { tableId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

export type DiningSessionDoc = mongoose.InferSchemaType<
  typeof diningSessionSchema
> & { _id: mongoose.Types.ObjectId };

export const DiningSession =
  mongoose.models.DiningSession ||
  mongoose.model("DiningSession", diningSessionSchema);
