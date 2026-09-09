import { Hono } from "hono";
import { z } from "zod";
import {
  listPartnersWithBalance,
  listArchivedPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  restorePartner,
  getPartnerLedger,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const partnerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  type: z.enum(["customer", "supplier", "both"]),
  notes: z.string().nullable().optional(),
});

export const partnerRoutes = new Hono();
partnerRoutes.use("*", requireAuth);

partnerRoutes.get("/", async (c) => {
  return c.json(await listPartnersWithBalance());
});

// "/:id" dan oldin ro'yxatdan o'tkazilishi shart, aks holda "archived" ":id"
// sifatida ushlanib qoladi.
partnerRoutes.get("/archived", async (c) => {
  return c.json(await listArchivedPartners());
});

partnerRoutes.get("/:id", async (c) => {
  const partner = await getPartner(c.req.param("id"));
  if (!partner) return c.json({ error: "Hamkor topilmadi" }, 404);
  return c.json(partner);
});

// Hamkorning to'liq hisob-varag'i: har bir sotilgan mahsulot qatori (mashina
// raqami, kg, narx, yuk puli) + har bir to'lov, sana bo'yicha ketma-ket va
// o'sib boruvchi qoldiq bilan (image.png dagi jadvalga o'xshash ko'rinish).
partnerRoutes.get("/:id/ledger", async (c) => {
  const partner = await getPartner(c.req.param("id"));
  if (!partner) return c.json({ error: "Hamkor topilmadi" }, 404);
  const rows = await getPartnerLedger(c.req.param("id"));
  return c.json(rows);
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

partnerRoutes.post("/:id/restore", async (c) => {
  const partner = await restorePartner(c.req.param("id"));
  if (!partner) return c.json({ error: "Hamkor topilmadi" }, 404);
  return c.json(partner);
});
