import { Hono } from "hono";
import { z } from "zod";
import {
  listWarehouses,
  listArchivedWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  restoreWarehouse,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const warehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const warehouseRoutes = new Hono();
warehouseRoutes.use("*", requireAuth);

warehouseRoutes.get("/", async (c) => {
  return c.json(await listWarehouses());
});

// "/:id" dan oldin ro'yxatdan o'tkazilishi shart, aks holda "archived" ":id"
// sifatida ushlanib qoladi.
warehouseRoutes.get("/archived", async (c) => {
  return c.json(await listArchivedWarehouses());
});

warehouseRoutes.get("/:id", async (c) => {
  const warehouse = await getWarehouse(c.req.param("id"));
  if (!warehouse) return c.json({ error: "Ombor topilmadi" }, 404);
  return c.json(warehouse);
});

warehouseRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = warehouseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const warehouse = await createWarehouse(parsed.data);
  return c.json(warehouse, 201);
});

warehouseRoutes.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = warehouseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const warehouse = await updateWarehouse(c.req.param("id"), parsed.data);
  if (!warehouse) return c.json({ error: "Ombor topilmadi" }, 404);
  return c.json(warehouse);
});

warehouseRoutes.delete("/:id", async (c) => {
  await deleteWarehouse(c.req.param("id"));
  return c.json({ ok: true });
});

warehouseRoutes.post("/:id/restore", async (c) => {
  const warehouse = await restoreWarehouse(c.req.param("id"));
  if (!warehouse) return c.json({ error: "Ombor topilmadi" }, 404);
  return c.json(warehouse);
});
