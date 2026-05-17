import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type StaffTokenPayload = {
  typ: "staff";
  sub: string;
  role: "admin" | "staff";
};

declare global {
  namespace Express {
    interface Request {
      staff?: StaffTokenPayload;
    }
  }
}

export function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined;
  if (!token) {
    res.status(401).json({ error: "Missing authorization" });
    return;
  }
  try {
    const payload = jwt.verify(token, env.STAFF_JWT_SECRET) as StaffTokenPayload;
    if (payload.typ !== "staff") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.staff = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.staff || req.staff.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}
