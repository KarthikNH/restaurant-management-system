import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../config/env.js";
import { DiningSession } from "../models/DiningSession.js";
import { OrderModel } from "../models/Order.js";
import { MenuItem } from "../models/MenuItem.js";
import { MenuCategory } from "../models/MenuCategory.js";
import { Table as RtTable } from "../models/Table.js";
import type { GuestTokenPayload } from "../middleware/guestAuth.js";
import { requireGuest } from "../middleware/guestAuth.js";
import { Router as createRouter, type Router } from "express";
import { ensureDraftOrder, getActiveDraftOrder } from "../lib/orders.js";
import { Review } from "../models/Review.js";

const sessionBody = z.object({ tableSlug: z.string().min(1) });

const itemBody = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
});

const reviewBody = z.object({
  reviewerName: z.string().max(100).optional(),
  overallRating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  feedbackType: z.enum(["comment", "suggestion", "complaint"]).optional(),
  menuItemReviews: z.array(
    z.object({
      menuItemId: z.string().min(1),
      rating: z.coerce.number().int().min(1).max(5),
    })
  ).optional(),
});

function signGuestCookie(res: Response, payload: GuestTokenPayload) {
  const token = jwt.sign(payload, env.GUEST_JWT_SECRET, { expiresIn: "8h" });
  res.cookie("guest_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

function isMongoDuplicate(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: number }).code === 11000
  );
}

async function consolidateSessionOrders(diningSessionId: any) {
  const orders = await OrderModel.find({ diningSessionId });
  if (orders.length <= 1) {
    for (const o of orders) {
      if (o.status !== "closed") {
        o.status = "closed";
        await o.save();
      }
    }
    return;
  }

  const linesMap: Record<string, { menuItemId: any; name: string; unitPriceCents: number; quantity: number; note: string }> = {};

  for (const o of orders) {
    for (const l of o.lines) {
      const key = `${l.menuItemId}_${l.unitPriceCents}`;
      if (linesMap[key]) {
        linesMap[key].quantity += l.quantity;
        if (l.note) {
          linesMap[key].note = linesMap[key].note ? `${linesMap[key].note}, ${l.note}` : l.note;
        }
      } else {
        linesMap[key] = {
          menuItemId: l.menuItemId,
          name: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          note: l.note || "",
        };
      }
    }
  }

  const primaryOrder = orders[0];
  primaryOrder.lines = Object.values(linesMap);
  primaryOrder.status = "closed";
  await primaryOrder.save();

  const otherOrderIds = orders.slice(1).map((o) => o._id);
  await OrderModel.deleteMany({ _id: { $in: otherOrderIds } });
}

export function guestRouter(): Router {
  const r = createRouter();

  r.post("/sessions", async (req: Request, res: Response) => {
    const parsed = sessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const table = await RtTable.findOne({
      tableSlug: parsed.data.tableSlug,
      active: true,
    });
    if (!table) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    let session = await DiningSession.findOne({
      tableId: table._id,
      status: "open",
    });
    if (!session) {
      try {
        session = await DiningSession.create({
          tableId: table._id,
          status: "open",
          partySize: 1,
        });
      } catch (e) {
        if (isMongoDuplicate(e)) {
          session = await DiningSession.findOne({
            tableId: table._id,
            status: "open",
          });
        } else {
          throw e;
        }
      }
    }
    if (!session) {
      res.status(500).json({ error: "Could not start session" });
      return;
    }

    if (!session.partySize || session.partySize < 1) {
      session.partySize = 1;
      await session.save();
    }

    await ensureDraftOrder(session._id);

    const payload: GuestTokenPayload = {
      typ: "guest",
      diningSessionId: String(session._id),
      tableId: String(table._id),
    };
    signGuestCookie(res, payload);

    res.json({
      table: { id: String(table._id), label: table.label, tableSlug: table.tableSlug },
      diningSessionId: String(session._id),
    });
  });

  r.get("/menu", requireGuest, async (_req: Request, res: Response) => {
    const categories = await MenuCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    const items = await MenuItem.find({ available: true }).lean();
    res.json({
      categories: categories.map((c) => ({
        id: String(c._id),
        name: c.name,
        sortOrder: c.sortOrder,
      })),
      items: items.map((i) => ({
        id: String(i._id),
        categoryId: String(i.categoryId),
        name: i.name,
        description: i.description,
        priceCents: i.priceCents,
        dietType: (i as any).dietType || "veg",
      })),
    });
  });

  r.get("/order", requireGuest, async (req: Request, res: Response) => {
    const sessionId = req.guest!.diningSessionId;
    const order = await getActiveDraftOrder(sessionId);
    if (!order) {
      res.status(404).json({ error: "No order for session" });
      return;
    }
    res.json({
      id: String(order._id),
      status: order.status,
      lines: order.lines.map((l: (typeof order.lines)[number]) => ({
        id: String(l._id),
        menuItemId: String(l.menuItemId),
        name: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
    });
  });

  r.post("/order/items", requireGuest, async (req: Request, res: Response) => {
    const parsed = itemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const sessionId = req.guest!.diningSessionId;
    const order = await getActiveDraftOrder(sessionId);
    if (!order) {
      res.status(404).json({ error: "No order for session" });
      return;
    }
    if (order.status !== "draft") {
      res.status(409).json({ error: "Order is no longer editable" });
      return;
    }

    const item = await MenuItem.findById(parsed.data.menuItemId);
    if (!item || !item.available) {
      res.status(400).json({ error: "Item unavailable" });
      return;
    }

    // Merge with existing line if same item is already in cart
    const existing = order.lines.find(
      (l) => String(l.menuItemId) === String(item._id)
    );
    if (existing) {
      existing.quantity += parsed.data.quantity;
    } else {
      order.lines.push({
        menuItemId: item._id,
        name: item.name,
        unitPriceCents: item.priceCents,
        quantity: parsed.data.quantity,
        note: parsed.data.note ?? "",
      });
    }
    await order.save();

    res.status(201).json({ ok: true });
  });

  // Remove one unit of an item from the draft cart
  r.post("/order/items/remove", requireGuest, async (req: Request, res: Response) => {
    const parsed = z.object({ menuItemId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const sessionId = req.guest!.diningSessionId;
    const order = await getActiveDraftOrder(sessionId);
    if (!order) {
      res.status(404).json({ error: "No order for session" });
      return;
    }
    if (order.status !== "draft") {
      res.status(409).json({ error: "Order is no longer editable" });
      return;
    }

    const lineIndex = order.lines.findIndex(
      (l) => String(l.menuItemId) === parsed.data.menuItemId
    );
    if (lineIndex === -1) {
      res.status(404).json({ error: "Item not found in cart" });
      return;
    }

    if (order.lines[lineIndex].quantity <= 1) {
      order.lines.splice(lineIndex, 1);
    } else {
      order.lines[lineIndex].quantity -= 1;
    }
    await order.save();

    res.json({ ok: true });
  });

  r.post("/order/place", requireGuest, async (req: Request, res: Response) => {
    const sessionId = req.guest!.diningSessionId;
    const order = await getActiveDraftOrder(sessionId);
    if (!order) {
      res.status(404).json({ error: "No order for session" });
      return;
    }
    if (order.status !== "draft") {
      res.status(409).json({ error: "Order already submitted" });
      return;
    }
    if (order.lines.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }
    order.status = "placed";
    await order.save();

    await OrderModel.create({
      diningSessionId: new mongoose.Types.ObjectId(sessionId),
      status: "draft",
      lines: [],
    });

    res.json({ ok: true, status: "placed" });
  });

  r.get("/orders/all", requireGuest, async (req: Request, res: Response) => {
    try {
      const sessionId = req.guest!.diningSessionId;
      const list = await OrderModel.find({ diningSessionId: new mongoose.Types.ObjectId(sessionId) })
        .sort({ createdAt: -1 })
        .lean();

      res.json(
        list.map((order) => ({
          id: String(order._id),
          status: order.status,
          createdAt: order.createdAt,
          lines: order.lines.map((l: any) => ({
            id: String(l._id),
            menuItemId: String(l.menuItemId),
            name: l.name,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            note: l.note,
          })),
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load orders" });
    }
  });

  r.post("/reviews", requireGuest, async (req: Request, res: Response) => {
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const review = await Review.create({
        reviewerName: parsed.data.reviewerName || "Anonymous",
        overallRating: parsed.data.overallRating,
        comment: parsed.data.comment || "",
        feedbackType: parsed.data.feedbackType || "comment",
        menuItemReviews: parsed.data.menuItemReviews || [],
        status: "pending", // require admin/staff moderation before publishing
      });

      res.status(201).json({ ok: true, reviewId: String(review._id) });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to save review" });
    }
  });

  r.get("/reviews", requireGuest, async (_req: Request, res: Response) => {
    try {
      const reviews = await Review.find({ status: "approved" })
        .sort({ createdAt: -1 })
        .populate("menuItemReviews.menuItemId", "name")
        .lean();

      res.json(
        reviews.map((rev) => ({
          id: String(rev._id),
          reviewerName: rev.reviewerName,
          overallRating: rev.overallRating,
          comment: rev.comment,
          feedbackType: rev.feedbackType,
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

  r.get("/reviews/stats", requireGuest, async (_req: Request, res: Response) => {
    try {
      const reviews = await Review.find({ status: "approved" }).lean();
      
      let overallAvg = 0;
      if (reviews.length > 0) {
        const sum = reviews.reduce((acc, r) => acc + r.overallRating, 0);
        overallAvg = sum / reviews.length;
      }

      const itemRatings: Record<string, { sum: number; count: number; average: number }> = {};
      for (const r of reviews) {
        if (r.menuItemReviews) {
          for (const ir of r.menuItemReviews) {
            const idStr = String(ir.menuItemId);
            if (!itemRatings[idStr]) {
              itemRatings[idStr] = { sum: 0, count: 0, average: 0 };
            }
            itemRatings[idStr].sum += ir.rating;
            itemRatings[idStr].count += 1;
          }
        }
      }

      for (const itemId of Object.keys(itemRatings)) {
        itemRatings[itemId].average = Number((itemRatings[itemId].sum / itemRatings[itemId].count).toFixed(1));
      }

      res.json({
        overallAverage: Number(overallAvg.toFixed(1)),
        totalReviewsCount: reviews.length,
        itemAverages: itemRatings,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to load statistics" });
    }
  });

  r.post("/settle", requireGuest, async (req: Request, res: Response) => {
    try {
      const sessionId = req.guest!.diningSessionId;
      
      // 1. Consolidate all orders for this session into a single closed order
      await consolidateSessionOrders(sessionId);

      // 2. Close the dining session
      await DiningSession.findByIdAndUpdate(sessionId, {
        $set: { status: "closed", partySize: 0 }
      });

      // 3. Clear guest token cookie to reset guest flow
      res.clearCookie("guest_token", { path: "/" });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to settle bill" });
    }
  });

  return r;
}
