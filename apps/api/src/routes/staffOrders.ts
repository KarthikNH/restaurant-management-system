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
    res.json({ ok: true, status: order.status });
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

  return r;
}
