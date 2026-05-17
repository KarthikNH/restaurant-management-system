import type { Request, Response } from "express";
import { z } from "zod";
import { OrderModel, type OrderDoc } from "../models/Order.js";
import { DiningSession, type DiningSessionDoc } from "../models/DiningSession.js";
import { Table as RtTable, type TableDoc } from "../models/Table.js";
import type { Router } from "express";
import { Router as createRouter } from "express";
import { requireStaff } from "../middleware/staffAuth.js";

const statusBody = z.object({
  status: z.enum(["draft", "placed", "confirmed", "closed"]),
});

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

export function staffOrdersRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);

  r.get("/", async (_req: Request, res: Response) => {
    const orders = await OrderModel.find({ status: { $ne: "draft" } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    const sessionIds = [...new Set(orders.map((o) => String(o.diningSessionId)))];
    const sessions = await DiningSession.find({ _id: { $in: sessionIds } }).lean();
    const tableIds = [...new Set(sessions.map((s) => String(s.tableId)))];
    const tables = await RtTable.find({ _id: { $in: tableIds } }).lean();
    const tableById = new Map(tables.map((t) => [String(t._id), t]));

    const sessionById = new Map(sessions.map((s) => [String(s._id), s]));

    res.json(
      orders.map((o) => {
        const s = sessionById.get(String(o.diningSessionId));
        const t = s ? tableById.get(String(s.tableId)) : undefined;
        return {
          id: String(o._id),
          status: o.status,
          diningSessionId: String(o.diningSessionId),
          tableLabel: t?.label ?? "?",
          tableSlug: t?.tableSlug,
          updatedAt: o.updatedAt,
          lineCount: o.lines.length,
        };
      }),
    );
  });

  r.get("/:orderId", async (req: Request, res: Response) => {
    const order = (await OrderModel.findById(req.params.orderId).lean()) as OrderDoc | null;
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const session = (await DiningSession.findById(order.diningSessionId).lean()) as
      | DiningSessionDoc
      | null;
    const table = session
      ? ((await RtTable.findById(session.tableId).lean()) as TableDoc | null)
      : null;
    res.json({
      id: String(order._id),
      status: order.status,
      updatedAt: order.updatedAt,
      table: table
        ? { label: table.label, tableSlug: table.tableSlug }
        : null,
      lines: order.lines.map((l: (typeof order.lines)[number]) => ({
        id: String(l._id),
        name: l.name,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
    });
  });

  r.patch("/:orderId/status", async (req: Request, res: Response) => {
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const order = await OrderModel.findByIdAndUpdate(
      req.params.orderId,
      { status: parsed.data.status },
      { new: true },
    );
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (parsed.data.status === "closed" && order.diningSessionId) {
      // 1. Consolidate all orders for this dining session into a single closed order
      await consolidateSessionOrders(order.diningSessionId);

      // 2. Close the dining session
      await DiningSession.findByIdAndUpdate(order.diningSessionId, {
        status: "closed",
        partySize: 0,
      });
    }

    res.json({ ok: true, status: "closed" });
  });

  r.delete("/:orderId", async (req: Request, res: Response) => {
    const order = await OrderModel.findById(req.params.orderId);
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (order.status !== "closed") {
      res.status(400).json({ error: "Only closed orders can be deleted" });
      return;
    }
    await OrderModel.findByIdAndDelete(req.params.orderId);
    res.json({ ok: true });
  });

  r.post("/merge", async (req: Request, res: Response) => {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length < 2) {
        res.status(400).json({ error: "Please select at least 2 tickets to merge" });
        return;
      }

      // Load all orders
      const orders = await OrderModel.find({ _id: { $in: orderIds } });
      if (orders.length !== orderIds.length) {
        res.status(404).json({ error: "Some selected orders could not be found" });
        return;
      }

      // Verify they are active
      for (const o of orders) {
        if (o.status === "closed") {
          res.status(400).json({ error: "Cannot merge closed/paid tickets" });
          return;
        }
      }

      // Merge lines into the first order
      const primaryOrder = orders[0];
      const otherOrders = orders.slice(1);

      const linesMap: Record<string, { menuItemId: any, name: string, unitPriceCents: number, quantity: number, note: string }> = {};

      // Load primary lines
      for (const l of primaryOrder.lines) {
        const key = `${l.menuItemId}_${l.unitPriceCents}`;
        linesMap[key] = {
          menuItemId: l.menuItemId,
          name: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          note: l.note || "",
        };
      }

      // Merge secondary lines
      for (const o of otherOrders) {
        for (const l of o.lines) {
          const key = `${l.menuItemId}_${l.unitPriceCents}`;
          if (linesMap[key]) {
            linesMap[key].quantity += l.quantity;
            if (l.note) {
              linesMap[key].note = linesMap[key].note 
                ? `${linesMap[key].note}, ${l.note}` 
                : l.note;
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

      // Update primary order lines
      primaryOrder.lines = Object.values(linesMap);
      
      // If any of the orders is confirmed, make the primary order confirmed
      if (orders.some(o => o.status === "confirmed")) {
        primaryOrder.status = "confirmed";
      }

      await primaryOrder.save();

      // Delete the other orders
      await OrderModel.deleteMany({ _id: { $in: otherOrders.map(o => o._id) } });

      res.json({ ok: true, mergedOrderId: String(primaryOrder._id) });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to merge orders" });
    }
  });

  return r;
}
