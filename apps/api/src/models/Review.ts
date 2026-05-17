import mongoose from "mongoose";

const menuItemReviewSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
});

const reviewSchema = new mongoose.Schema(
  {
    reviewerName: {
      type: String,
      default: "Anonymous",
    },
    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
    },
    feedbackType: {
      type: String,
      enum: ["comment", "suggestion", "complaint"],
      default: "comment",
    },
    menuItemReviews: [menuItemReviewSchema],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export type ReviewDoc = mongoose.InferSchemaType<typeof reviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Review =
  mongoose.models.Review || mongoose.model("Review", reviewSchema);
