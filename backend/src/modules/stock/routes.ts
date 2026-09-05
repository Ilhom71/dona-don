import { Hono } from "hono";
import { z } from "zod";
import { createMovement, createTransfer, listMovements, listProductStock } from "./service";
import { requireAuth } from "../../middleware/auth";

const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["in", "out"]),
  quantity: z.number().positive(),
  pricePerUnit: z.number().positive().nullable().optional(),
  currency: z.enum(["UZS", "USD"]).default("UZS"),
  partnerId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid("Ombor tanlanishi shart"),
  vehicleNumber: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  movementDate: z.coerce.date().optional(),
});

const transferSchema = z.object({
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid("Manba ombor tanlanishi shart"),
  toWarehouseId: z.string().uuid("Maqsad ombor tanlanishi shart"),
  quantity: z.number().positive(),
  vehicleNumber: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  movementDate: z.coerce.date().optional(),
});

export const stockRoutes = new Hono();
stockRoutes.use("*", requireAuth);

stockRoutes.get("/movements", async (c) => {
  const { productId, type, warehouseId, from, to } = c.req.query();
  const movements = await listMovements({
    productId: productId || undefined,
    type: (type as "in" | "out") || undefined,
    warehouseId: warehouseId || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(movements);
});

stockRoutes.post("/movements", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = movementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const movement = await createMovement(parsed.data);
    return c.json(movement, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

stockRoutes.get("/levels", async (c) => {
  const { productId, warehouseId } = c.req.query();
  const levels = await listProductStock({
    productId: productId || undefined,
    warehouseId: warehouseId || undefined,
  });
  return c.json(levels);
});

stockRoutes.post("/transfers", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const movement = await createTransfer(parsed.data);
    return c.json(movement, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
