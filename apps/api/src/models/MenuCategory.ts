import mongoose from "mongoose";

const menuCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type MenuCategoryDoc = mongoose.InferSchemaType<
  typeof menuCategorySchema
> & { _id: mongoose.Types.ObjectId };

export const MenuCategory =
  mongoose.models.MenuCategory ||
  mongoose.model("MenuCategory", menuCategorySchema);
