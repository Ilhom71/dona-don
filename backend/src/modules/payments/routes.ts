import { Hono } from "hono";
import { z } from "zod";
import { createPayment, listPayments } from "./service";
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
