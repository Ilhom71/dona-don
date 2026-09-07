import { Hono } from "hono";
import { z } from "zod";
import { createPayment, listPayments, cancelPayment, restorePayment } from "./service";
import { requireAuth } from "../../middleware/auth";

const paymentSchema = z.object({
  partnerId: z.string().uuid(),
  saleId: z.string().uuid().nullable().optional(),
  amount: z.number().positive(),
  currency: z.enum(["UZS", "USD"]).default("UZS"),
  method: z.enum(["cash", "card", "bank"]).optional(),
  notes: z.string().nullable().optional(),
  paymentDate: z.coerce.date().optional(),
});

const cancelSchema = z.object({ reason: z.string().nullable().optional() });

export const paymentRoutes = new Hono();
paymentRoutes.use("*", requireAuth);

paymentRoutes.get("/", async (c) => {
  const { partnerId, saleId } = c.req.query();
  const list = await listPayments({ partnerId: partnerId || undefined, saleId: saleId || undefined });
  return c.json(list);
});

paymentRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const payment = await createPayment(parsed.data);
  return c.json(payment, 201);
});

paymentRoutes.post("/:id/cancel", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const payment = await cancelPayment(c.req.param("id"), parsed.data.reason);
    return c.json(payment);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

paymentRoutes.post("/:id/restore", async (c) => {
  try {
    const payment = await restorePayment(c.req.param("id"));
    return c.json(payment);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
