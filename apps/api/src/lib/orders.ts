import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";

export async function getActiveDraftOrder(
  sessionId: string | mongoose.Types.ObjectId,
) {
  return OrderModel.findOne({ diningSessionId: sessionId, status: "draft" }).sort({
    updatedAt: -1,
  });
}

export async function ensureDraftOrder(sessionId: mongoose.Types.ObjectId) {
  let order = await getActiveDraftOrder(sessionId);
  if (!order) {
    order = await OrderModel.create({
      diningSessionId: sessionId,
      status: "draft",
      lines: [],
    });
  }
  return order;
}
