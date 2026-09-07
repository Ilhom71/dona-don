import { Hono } from "hono";
import { z } from "zod";
import { createSale, listSales, getSale, cancelSale } from "./service";
import { requireAuth } from "../../middleware/auth";

const saleSchema = z.object({
  partnerId: z.string().uuid(),
  warehouseId: z.string().uuid("Ombor tanlanishi shart"),
  vehicleNumber: z.string().nullable().optional(),
  saleDate: z.coerce.date().optional(),
  currency: z.enum(["UZS", "USD"]).default("UZS"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        // yuk puli (tashish xarajati), doim UZS, ixtiyoriy - kiritilmasa 0
        freightCostUzs: z.number().nonnegative().nullable().optional(),
      })
    )
    .min(1),
  initialPayment: z.number().nonnegative().nullable().optional(),
  paymentMethod: z.enum(["cash", "card", "bank"]).optional(),
  notes: z.string().nullable().optional(),
});

const cancelSchema = z.object({
  reason: z.string().nullable().optional(),
});

const cancelBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Kamida bitta savdo tanlanishi shart"),
  reason: z.string().nullable().optional(),
});

export const saleRoutes = new Hono();
saleRoutes.use("*", requireAuth);

saleRoutes.get("/", async (c) => {
  const { partnerId, paymentStatus, from, to } = c.req.query();
  const sales = await listSales({
    partnerId: partnerId || undefined,
    paymentStatus: (paymentStatus as "paid" | "partial" | "credit" | "cancelled") || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(sales);
});

saleRoutes.get("/:id", async (c) => {
  const sale = await getSale(c.req.param("id"));
  if (!sale) return c.json({ error: "Savdo topilmadi" }, 404);
  return c.json(sale);
});

saleRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const sale = await createSale(parsed.data);
    return c.json(sale, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// Bitta savdoni bekor qilish (storno) - yozuv o'chirilmaydi, faqat teskari
// ombor yozuvi qo'shilib, holati "cancelled" qilib belgilanadi.
saleRoutes.post("/:id/cancel", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const sale = await cancelSale(c.req.param("id"), parsed.data.reason);
    return c.json(sale);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// Savdo tarixida bir nechta belgilangan savdoni birdaniga bekor qilish.
// Har biri alohida tranzaksiyada bajariladi - biri xato bersa, boshqalari
// baribir bekor qilinishda davom etadi va natija xabarlarda qaytariladi.
saleRoutes.post("/cancel-bulk", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = cancelBulkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const results = await Promise.all(
    parsed.data.ids.map(async (id) => {
      try {
        await cancelSale(id, parsed.data.reason);
        return { id, ok: true as const };
      } catch (err) {
        return { id, ok: false as const, error: (err as Error).message };
      }
    })
  );
  return c.json({ results });
});
