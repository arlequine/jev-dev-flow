// demo-shop · API de órdenes.
import { Router } from "express";
import { orders } from "../db";
import { requireLogin } from "../auth/requireLogin";

export const router = Router();

router.get("/orders/:id", requireLogin, async (req, res) => {
  const order = await orders.findOne({ id: req.params.id, customerId: req.user.id });
  if (!order) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json(order);
});
