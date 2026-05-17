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

const sessionBody = z.object({ tableSlug: z.string().min(1) });

const itemBody = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
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

    order.lines.push({
      menuItemId: item._id,
      name: item.name,
      unitPriceCents: item.priceCents,
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? "",
    });
    await order.save();

    res.status(201).json({ ok: true });
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

  return r;
}
