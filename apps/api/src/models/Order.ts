import mongoose from "mongoose";

const orderLineSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String, required: true },
    unitPriceCents: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
  },
  { _id: true },
);

const orderSchema = new mongoose.Schema(
  {
    diningSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiningSession",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "placed", "confirmed", "closed"],
      default: "draft",
    },
    lines: { type: [orderLineSchema], default: [] },
  },
  { timestamps: true },
);

export type OrderDoc = mongoose.InferSchemaType<typeof orderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OrderModel =
  mongoose.models.Order || mongoose.model("Order", orderSchema);
