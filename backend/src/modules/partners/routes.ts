import { Hono } from "hono";
import { z } from "zod";
import {
  listPartnersWithBalance,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const partnerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  type: z.enum(["customer", "supplier", "both"]),
  notes: z.string().nullable().optional(),
});

export const partnerRoutes = new Hono();
partnerRoutes.use("*", requireAuth);

partnerRoutes.get("/", async (c) => {
  return c.json(await listPartnersWithBalance());
});

partnerRoutes.get("/:id", async (c) => {
  const partner = await getPartner(c.req.param("id"));
  if (!partner) return c.json({ error: "Hamkor topilmadi" }, 404);
  return c.json(partner);
});

partnerRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = partnerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const partner = await createPartner(parsed.data);
  return c.json(partner, 201);
});

partnerRoutes.put("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = partnerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const partner = await updatePartner(c.req.param("id"), parsed.data);
  if (!partner) return c.json({ error: "Hamkor topilmadi" }, 404);
  return c.json(partner);
});

partnerRoutes.delete("/:id", async (c) => {
  await deletePartner(c.req.param("id"));
  return c.json({ ok: true });
});
