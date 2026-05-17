import type { Request, Response } from "express";
import { z } from "zod";
import { Review } from "../models/Review.js";
import { MenuItem } from "../models/MenuItem.js";
import type { Router } from "express";
import { Router as createRouter } from "express";
import { requireStaff } from "../middleware/staffAuth.js";

const statusBody = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

export function staffReviewsRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);

  // Get all reviews for moderation
  r.get("/", async (_req: Request, res: Response) => {
    try {
      const list = await Review.find()
        .sort({ createdAt: -1 })
        .populate("menuItemReviews.menuItemId", "name")
        .lean();

      res.json(
        list.map((rev) => ({
          id: String(rev._id),
          reviewerName: rev.reviewerName,
          overallRating: rev.overallRating,
          comment: rev.comment,
          feedbackType: rev.feedbackType,
          status: rev.status,
          createdAt: rev.createdAt,
          menuItemReviews: (rev.menuItemReviews || []).map((ir: any) => ({
            id: String(ir._id),
            menuItemId: ir.menuItemId ? String(ir.menuItemId._id || ir.menuItemId) : "",
            name: ir.menuItemId ? ir.menuItemId.name || "Unknown Item" : "Unknown Item",
            rating: ir.rating,
          })),
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load reviews" });
    }
  });

  // Approve/Reject/Moderate review status
  r.patch("/:reviewId/status", async (req: Request, res: Response) => {
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const review = await Review.findByIdAndUpdate(
        req.params.reviewId,
        { status: parsed.data.status },
        { new: true }
      );

      if (!review) {
        res.status(404).json({ error: "Review not found" });
        return;
      }

      res.json({ ok: true, status: review.status });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to moderate review" });
    }
  });

  // Delete review (spam/inappropriate)
  r.delete("/:reviewId", async (req: Request, res: Response) => {
    try {
      const review = await Review.findByIdAndDelete(req.params.reviewId);
      if (!review) {
        res.status(404).json({ error: "Review not found" });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to delete review" });
    }
  });

  // Get review analytics
  r.get("/analytics", async (_req: Request, res: Response) => {
    try {
      const approvedReviews = await Review.find({ status: "approved" }).lean();
      const menuItems = await MenuItem.find().lean();

      // 1. Most liked dishes analytics
      const itemRatings: Record<string, { sum: number; count: number; name: string }> = {};
      for (const item of menuItems) {
        itemRatings[String(item._id)] = { sum: 0, count: 0, name: item.name };
      }

      for (const r of approvedReviews) {
        if (r.menuItemReviews) {
          for (const ir of r.menuItemReviews) {
            const idStr = String(ir.menuItemId);
            if (itemRatings[idStr]) {
              itemRatings[idStr].sum += ir.rating;
              itemRatings[idStr].count += 1;
            }
          }
        }
      }

      const dishesAnalytics = Object.entries(itemRatings)
        .map(([id, data]) => ({
          id,
          name: data.name,
          averageRating: data.count > 0 ? Number((data.sum / data.count).toFixed(2)) : 0,
          totalReviews: data.count,
        }))
        .filter((dish) => dish.totalReviews > 0)
        .sort((a, b) => b.averageRating - a.averageRating || b.totalReviews - a.totalReviews);

      // 2. Satisfaction trends analytics
      const totalApproved = approvedReviews.length;
      const overallSum = approvedReviews.reduce((acc, r) => acc + r.overallRating, 0);
      const overallAverage = totalApproved > 0 ? Number((overallSum / totalApproved).toFixed(2)) : 0;

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const feedbackTypeBreakdown = { comment: 0, suggestion: 0, complaint: 0 };

      for (const r of approvedReviews) {
        const ratingKey = r.overallRating as 1 | 2 | 3 | 4 | 5;
        if (ratingDistribution[ratingKey] !== undefined) {
          ratingDistribution[ratingKey] += 1;
        }

        const typeKey = r.feedbackType as "comment" | "suggestion" | "complaint";
        if (feedbackTypeBreakdown[typeKey] !== undefined) {
          feedbackTypeBreakdown[typeKey] += 1;
        }
      }

      // Group by daily trend
      const dailyTrend: Record<string, { sum: number; count: number; average: number }> = {};
      for (const r of approvedReviews) {
        const dateStr = new Date(r.createdAt || Date.now()).toISOString().split("T")[0];
        if (!dailyTrend[dateStr]) {
          dailyTrend[dateStr] = { sum: 0, count: 0, average: 0 };
        }
        dailyTrend[dateStr].sum += r.overallRating;
        dailyTrend[dateStr].count += 1;
      }

      for (const dateStr of Object.keys(dailyTrend)) {
        dailyTrend[dateStr].average = Number((dailyTrend[dateStr].sum / dailyTrend[dateStr].count).toFixed(2));
      }

      const sortedTrend = Object.entries(dailyTrend)
        .map(([date, data]) => ({
          date,
          averageRating: data.average,
          reviewCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        overallAverage,
        totalApprovedReviews: totalApproved,
        ratingDistribution,
        feedbackTypeBreakdown,
        dailySatisfactionTrend: sortedTrend,
        mostLikedDishes: dishesAnalytics,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load analytics" });
    }
  });

  return r;
}
