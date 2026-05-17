import type { Request, Response } from "express";
import { z } from "zod";
import { MenuCategory } from "../models/MenuCategory.js";
import { MenuItem } from "../models/MenuItem.js";
import type { Router } from "express";
import { Router as createRouter } from "express";
import { requireStaff } from "../middleware/staffAuth.js";

const catBody = z.object({ name: z.string().min(1), sortOrder: z.number().optional() });
const itemBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  available: z.boolean().optional(),
});

export function staffMenuRouter(): Router {
  const r = createRouter();
  r.use(requireStaff);

  r.get("/categories", async (_req: Request, res: Response) => {
    const list = await MenuCategory.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json(list.map((c) => ({ id: String(c._id), name: c.name, sortOrder: c.sortOrder })));
  });

  r.post("/categories", async (req: Request, res: Response) => {
    const parsed = catBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const c = await MenuCategory.create({
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
    res.status(201).json({ id: String(c._id), name: c.name, sortOrder: c.sortOrder });
  });

  r.get("/items", async (_req: Request, res: Response) => {
    const list = await MenuItem.find().sort({ name: 1 }).lean();
    res.json(
      list.map((i) => ({
        id: String(i._id),
        categoryId: String(i.categoryId),
        name: i.name,
        description: i.description,
        priceCents: i.priceCents,
        available: i.available,
        dietType: (i as any).dietType || "veg",
      })),
    );
  });

  r.post("/items", async (req: Request, res: Response) => {
    const parsed = itemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const i = await MenuItem.create({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      priceCents: parsed.data.priceCents,
      available: parsed.data.available ?? true,
    });
    res.status(201).json({ id: String(i._id) });
  });

  r.patch("/items/:itemId", async (req: Request, res: Response) => {
    const patch = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priceCents: z.number().int().min(0).optional(),
        available: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!patch.success) {
      res.status(400).json({ error: patch.error.flatten() });
      return;
    }
    const item = await MenuItem.findByIdAndUpdate(req.params.itemId, patch.data, {
      new: true,
    });
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  });

  return r;
}
