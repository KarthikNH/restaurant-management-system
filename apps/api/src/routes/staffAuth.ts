import type { Request, Response, Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Router as createRouter } from "express";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function staffAuthRouter(): Router {
  const r = createRouter();

  r.post("/login", async (req: Request, res: Response) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = jwt.sign(
      { typ: "staff", sub: String(user._id), role: user.role },
      env.STAFF_JWT_SECRET,
      { expiresIn: "12h" },
    );
    res.json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role },
    });
  });

  return r;
}
