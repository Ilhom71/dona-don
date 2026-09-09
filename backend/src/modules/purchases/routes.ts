import { Hono } from "hono";
import { z } from "zod";
import { createPurchase, updatePurchase, listPurchases, getPurchase, cancelPurchase } from "./service";
import { requireAuth } from "../../middleware/auth";

const cancelSchema = z.object({ reason: z.string().nullable().optional() });

const purchaseSchema = z.object({
  partnerId: z.string().uuid("Hamkor tanlanishi shart"),
  warehouseId: z.string().uuid("Ombor tanlanishi shart"),
  vehicleNumber: z.string().nullable().optional(),
  purchaseDate: z.coerce.date().optional(),
  currency: z.enum(["UZS", "USD"]).default("UZS"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1, "Kamida bitta mahsulot qo'shing"),
  initialPayment: z.number().nonnegative().nullable().optional(),
  paymentMethod: z.enum(["cash", "card", "bank"]).optional(),
  notes: z.string().nullable().optional(),
});

// Tahrirlashda to'lov o'zgartirilmaydi - initialPayment/paymentMethod yo'q.
const purchaseUpdateSchema = purchaseSchema.omit({ initialPayment: true, paymentMethod: true });

export const purchaseRoutes = new Hono();
purchaseRoutes.use("*", requireAuth);

purchaseRoutes.get("/", async (c) => {
  const { partnerId, paymentStatus, from, to } = c.req.query();
  const rows = await listPurchases({
    partnerId: partnerId || undefined,
    paymentStatus: (paymentStatus as "paid" | "partial" | "credit" | "cancelled") || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(rows);
});

purchaseRoutes.get("/:id", async (c) => {
  const purchase = await getPurchase(c.req.param("id"));
  if (!purchase) return c.json({ error: "Xarid topilmadi" }, 404);
  return c.json(purchase);
});

purchaseRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const purchase = await createPurchase(parsed.data);
    return c.json(purchase, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

purchaseRoutes.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = purchaseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const purchase = await updatePurchase(c.req.param("id"), parsed.data);
    return c.json(purchase);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

purchaseRoutes.post("/:id/cancel", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const purchase = await cancelPurchase(c.req.param("id"), parsed.data.reason);
    return c.json(purchase);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
