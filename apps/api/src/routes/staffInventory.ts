import type { Request, Response } from "express";
import { z } from "zod";
import { InventoryItem } from "../models/InventoryItem.js";
import type { Router } from "express";
import { Router as createRouter } from "express";
import { requireStaff } from "../middleware/staffAuth.js";

const itemBody = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  minimumThreshold: z.number().min(0).optional(),
});

export function staffInventoryRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);

  r.get("/items", async (_req: Request, res: Response) => {
    const list = await InventoryItem.find().sort({ category: 1, name: 1 }).lean();
    res.json(
      list.map((i) => ({
        id: String(i._id),
        name: i.name,
        category: i.category,
        unit: i.unit,
        quantity: i.quantity,
        minimumThreshold: i.minimumThreshold,
      })),
    );
  });

  r.post("/items", async (req: Request, res: Response) => {
    const parsed = itemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const i = await InventoryItem.create({
      name: parsed.data.name,
      category: parsed.data.category,
      unit: parsed.data.unit,
      quantity: parsed.data.quantity,
      minimumThreshold: parsed.data.minimumThreshold ?? 10,
    });
    res.status(201).json({ id: String(i._id) });
  });

  r.patch("/items/:itemId", async (req: Request, res: Response) => {
    const patch = z
      .object({
        name: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        unit: z.string().min(1).optional(),
        quantity: z.number().min(0).optional(),
        minimumThreshold: z.number().min(0).optional(),
      })
      .safeParse(req.body);
    if (!patch.success) {
      res.status(400).json({ error: patch.error.flatten() });
      return;
    }
    const item = await InventoryItem.findByIdAndUpdate(req.params.itemId, patch.data, {
      new: true,
    });
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  });
  
  r.delete("/items/:itemId", async (req: Request, res: Response) => {
    const item = await InventoryItem.findByIdAndDelete(req.params.itemId);
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  });

  return r;
}
