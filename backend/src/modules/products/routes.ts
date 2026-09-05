import { Hono } from "hono";
import { z } from "zod";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const productSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(["kg", "ton"]),
  minStockAlert: z.string().nullable().optional(),
  sellingPriceUzs: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const productRoutes = new Hono();
productRoutes.use("*", requireAuth);

productRoutes.get("/", async (c) => {
  return c.json(await listProducts());
});

productRoutes.get("/:id", async (c) => {
  const product = await getProduct(c.req.param("id"));
  if (!product) return c.json({ error: "Mahsulot topilmadi" }, 404);
  return c.json(product);
});

productRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const product = await createProduct(parsed.data);
  return c.json(product, 201);
});

productRoutes.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = productSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const product = await updateProduct(c.req.param("id"), parsed.data);
  if (!product) return c.json({ error: "Mahsulot topilmadi" }, 404);
  return c.json(product);
});

productRoutes.delete("/:id", async (c) => {
  await deleteProduct(c.req.param("id"));
  return c.json({ ok: true });
});
