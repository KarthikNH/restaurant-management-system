import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    priceCents: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true },
    dietType: {
      type: String,
      enum: ["veg", "egg", "non-veg"],
      default: "veg",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuCategory",
      required: true,
    },
  },
  { timestamps: true },
);

export type MenuItemDoc = mongoose.InferSchemaType<typeof menuItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MenuItem =
  mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
