import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    tableSlug: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true },
    seatCapacity: { type: Number, default: 4, min: 1, max: 99 },
    sortOrder: { type: Number, default: 999 },
    // Soft-delete: set to a Date when the table is deleted.
    // The slug is kept so layout upserts never recreate this table.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

tableSchema.index({ sortOrder: 1, label: 1 });

export type TableDoc = mongoose.InferSchemaType<typeof tableSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Table =
  mongoose.models.Table || mongoose.model("Table", tableSchema);
