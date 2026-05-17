import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type GuestTokenPayload = {
  typ: "guest";
  diningSessionId: string;
  tableId: string;
};

declare global {
  namespace Express {
    interface Request {
      guest?: GuestTokenPayload;
    }
  }
}

export function requireGuest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.guest_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing guest session" });
    return;
  }
  try {
    const payload = jwt.verify(token, env.GUEST_JWT_SECRET) as GuestTokenPayload;
    if (payload.typ !== "guest") {
      res.status(401).json({ error: "Invalid guest session" });
      return;
    }
    req.guest = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired guest session" });
  }
}

export function optionalGuest(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.guest_token as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(token, env.GUEST_JWT_SECRET) as GuestTokenPayload;
    if (payload.typ === "guest") req.guest = payload;
  } catch {
    /* ignore */
  }
  next();
}
