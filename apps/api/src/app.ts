import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { guestRouter } from "./routes/guest.js";
import { staffAuthRouter } from "./routes/staffAuth.js";
import { staffTablesRouter } from "./routes/staffTables.js";
import { staffMenuRouter } from "./routes/staffMenu.js";
import { staffOrdersRouter } from "./routes/staffOrders.js";
import { staffInventoryRouter } from "./routes/staffInventory.js";
import { staffReviewsRouter } from "./routes/staffReviews.js";
import { staffEmployeesRouter } from "./routes/staffEmployees.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/guest", guestRouter());
  app.use("/api/staff/auth", staffAuthRouter());
  app.use("/api/staff/tables", staffTablesRouter());
  app.use("/api/staff/menu", staffMenuRouter());
  app.use("/api/staff/orders", staffOrdersRouter());
  app.use("/api/staff/inventory", staffInventoryRouter());
  app.use("/api/staff/reviews", staffReviewsRouter());
  app.use("/api/staff/employees", staffEmployeesRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
