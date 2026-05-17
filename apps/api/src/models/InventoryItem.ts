import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, default: 0, required: true },
    minimumThreshold: { type: Number, default: 10, required: true },
  },
  { timestamps: true },
);

export type InventoryItemDoc = mongoose.InferSchemaType<typeof inventoryItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model("InventoryItem", inventoryItemSchema);
