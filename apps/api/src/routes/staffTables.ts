import type { Request, Response, Router } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { Table as RtTable, type TableDoc } from "../models/Table.js";
import { DiningSession, type DiningSessionDoc } from "../models/DiningSession.js";
import { OrderModel } from "../models/Order.js";
import { MenuCategory } from "../models/MenuCategory.js";
import { MenuItem } from "../models/MenuItem.js";
import { Router as createRouter } from "express";
import { requireStaff } from "../middleware/staffAuth.js";
import { ensureDraftOrder, getActiveDraftOrder } from "../lib/orders.js";

function randomSlug(len = 8) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len).toUpperCase();
}

const createTableBody = z.object({
  label: z.string().min(1).max(80),
  seatCapacity: z.coerce.number().int().min(1).max(99).optional(),
});

const layoutBody = z.object({
  tableCount: z.coerce.number().int().min(1).max(50),
  seatsEach: z.coerce.number().int().min(1).max(99),
});

const patchTableBody = z.object({
  label: z.string().min(1).max(80).optional(),
  seatCapacity: z.coerce.number().int().min(1).max(99).optional(),
});

const sessionBody = z.object({
  partySize: z.coerce.number().int().min(1).max(99),
});

const itemBody = z.object({
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  note: z.string().max(500).optional(),
});

function tableObjectId(req: Request, res: Response) {
  if (!mongoose.isValidObjectId(req.params.tableId)) {
    res.status(400).json({ error: "Invalid table id" });
    return null;
  }
  return new mongoose.Types.ObjectId(req.params.tableId);
}

function isMongoDuplicate(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: number }).code === 11000
  );
}

async function loadMenuJson() {
  const categories = await MenuCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
  const items = await MenuItem.find({ available: true }).lean();
  return {
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
  };
}

export function staffTablesRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);

  r.post("/layout", async (req: Request, res: Response) => {
    const parsed = layoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { tableCount, seatsEach } = parsed.data;
    for (let i = 1; i <= tableCount; i++) {
      const label = `Table ${i}`;
      const tableSlug = `TABLE${String(i).padStart(2, "0")}`;
      // Skip slugs that have been manually deleted — they stay dead.
      await RtTable.findOneAndUpdate(
        { tableSlug, deletedAt: null },
        {
          $set: {
            label,
            seatCapacity: seatsEach,
            sortOrder: i,
            active: true,
          },
        },
        { upsert: true },
      );
    }
    await RtTable.updateMany(
      { tableSlug: { $regex: /^TABLE\d{2}$/ }, sortOrder: { $gt: tableCount }, deletedAt: null },
      { $set: { active: false } },
    );
    res.json({ ok: true });
  });

  r.get("/", async (_req: Request, res: Response) => {
    const tables = await RtTable.find({ active: true, deletedAt: null }).sort({ sortOrder: 1, label: 1 }).lean();
    const tableIds = tables.map((t) => t._id);
    const sessions = await DiningSession.find({
      tableId: { $in: tableIds },
      status: "open",
    }).lean();
    const sessionByTableId = new Map(sessions.map((s) => [String(s.tableId), s]));

    res.json(
      tables.map((t) => {
        const cap = t.seatCapacity ?? 4;
        const session = sessionByTableId.get(String(t._id));
        const party = session?.partySize ?? 0;
        const occupied = Boolean(session && party > 0);
        const vacantAtTable = occupied ? Math.max(0, cap - party) : cap;
        return {
          id: String(t._id),
          label: t.label,
          tableSlug: t.tableSlug,
          active: t.active,
          seatCapacity: cap,
          sortOrder: t.sortOrder ?? 999,
          openSessionId: session ? String(session._id) : null,
          partySize: occupied ? party : 0,
          occupied,
          vacantSeats: vacantAtTable,
        };
      }),
    );
  });

  r.post("/", async (req: Request, res: Response) => {
    const parsed = createTableBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    let slug = randomSlug(8);
    for (let i = 0; i < 5; i++) {
      const exists = await RtTable.exists({ tableSlug: slug });
      if (!exists) break;
      slug = randomSlug(8);
    }
    const maxSort = await RtTable.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();
    const sortOrder = ((maxSort as { sortOrder?: number } | null)?.sortOrder ?? 0) + 1;
    const table = await RtTable.create({
      label: parsed.data.label,
      tableSlug: slug,
      active: true,
      seatCapacity: parsed.data.seatCapacity ?? 4,
      sortOrder,
    });
    res.status(201).json({
      id: String(table._id),
      label: table.label,
      tableSlug: table.tableSlug,
      seatCapacity: table.seatCapacity,
    });
  });

  r.get("/:tableId", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const t = (await RtTable.findById(oid).lean()) as TableDoc | null;
    if (!t) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const cap = t.seatCapacity ?? 4;
    const session = (await DiningSession.findOne({ tableId: oid, status: "open" }).lean()) as
      | DiningSessionDoc
      | null;
    const party = session?.partySize ?? 0;
    const occupied = Boolean(session && party > 0);
    const vacantAtTable = occupied ? Math.max(0, cap - party) : cap;
    res.json({
      id: String(t._id),
      label: t.label,
      tableSlug: t.tableSlug,
      active: t.active,
      seatCapacity: cap,
      openSessionId: session ? String(session._id) : null,
      partySize: occupied ? party : 0,
      occupied,
      vacantSeats: vacantAtTable,
    });
  });

  r.patch("/:tableId", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const parsed = patchTableBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const table = await RtTable.findByIdAndUpdate(oid, { $set: parsed.data }, { new: true });
    if (!table) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      id: String(table._id),
      label: table.label,
      tableSlug: table.tableSlug,
      seatCapacity: table.seatCapacity ?? 4,
    });
  });

  r.delete("/:tableId", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;

    const table = await RtTable.findById(oid);
    if (!table || table.deletedAt) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    // Close all open sessions and their in-progress orders before deleting.
    const sessions = await DiningSession.find({ tableId: oid, status: "open" }).lean();
    const sessionIds = sessions.map((s) => s._id);
    if (sessionIds.length > 0) {
      await DiningSession.updateMany({ _id: { $in: sessionIds } }, { $set: { status: "closed", partySize: 0 } });
      await OrderModel.updateMany(
        { diningSessionId: { $in: sessionIds }, status: { $ne: "closed" } },
        { $set: { status: "closed" } },
      );
    }

    // Soft-delete: keep the slug reserved so layout upserts can never recreate this table.
    await RtTable.findByIdAndUpdate(oid, { $set: { active: false, deletedAt: new Date() } });

    res.json({ ok: true });
  });

  r.post("/:tableId/close-session", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;

    const sessions = await DiningSession.find({ tableId: oid, status: "open" }).lean();
    if (sessions.length === 0) {
      res.status(404).json({ error: "No open session" });
      return;
    }
    const sessionIds = sessions.map((s) => s._id);

    await DiningSession.updateMany(
      { _id: { $in: sessionIds } },
      { $set: { status: "closed", partySize: 0 } },
    );
    await OrderModel.updateMany(
      { diningSessionId: { $in: sessionIds }, status: { $ne: "closed" } },
      { $set: { status: "closed" } },
    );
    res.json({ ok: true });
  });

  r.post("/:tableId/session", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const parsed = sessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const table = await RtTable.findOne({ _id: oid, active: true });
    if (!table) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    let session = await DiningSession.findOne({ tableId: oid, status: "open" });
    if (!session) {
      try {
        session = await DiningSession.create({
          tableId: oid,
          status: "open",
          partySize: parsed.data.partySize,
        });
      } catch (e) {
        if (isMongoDuplicate(e)) {
          session = await DiningSession.findOne({ tableId: oid, status: "open" });
        } else {
          throw e;
        }
      }
    }
    if (!session) {
      res.status(500).json({ error: "Could not open session" });
      return;
    }
    session.partySize = parsed.data.partySize;
    await session.save();
    await ensureDraftOrder(session._id);

    res.json({ ok: true, diningSessionId: String(session._id) });
  });

  r.get("/:tableId/menu", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const exists = await RtTable.exists({ _id: oid, active: true });
    if (!exists) {
      res.status(404).json({ error: "Table not found" });
      return;
    }
    res.json(await loadMenuJson());
  });

  r.get("/:tableId/order", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const session = await DiningSession.findOne({ tableId: oid, status: "open" });
    if (!session) {
      res.status(404).json({ error: "No open session" });
      return;
    }
    const order = await getActiveDraftOrder(session._id);
    if (!order) {
      res.status(404).json({ error: "No draft order" });
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

  r.post("/:tableId/order/items", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const parsed = itemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const session = await DiningSession.findOne({ tableId: oid, status: "open" });
    if (!session) {
      res.status(404).json({ error: "No open session" });
      return;
    }
    const order = await getActiveDraftOrder(session._id);
    if (!order) {
      res.status(404).json({ error: "No draft order" });
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

  r.post("/:tableId/order/place", async (req: Request, res: Response) => {
    const oid = tableObjectId(req, res);
    if (!oid) return;
    const session = await DiningSession.findOne({ tableId: oid, status: "open" });
    if (!session) {
      res.status(404).json({ error: "No open session" });
      return;
    }
    const order = await getActiveDraftOrder(session._id);
    if (!order) {
      res.status(404).json({ error: "No draft order" });
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
      diningSessionId: session._id,
      status: "draft",
      lines: [],
    });

    res.json({ ok: true, status: "placed" });
  });

  return r;
}
