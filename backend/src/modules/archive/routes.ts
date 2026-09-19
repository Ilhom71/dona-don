import { Hono } from "hono";
import { z } from "zod";
import { purgeArchive } from "./service";
import { requireAuth } from "../../middleware/auth";

const purgeSchema = z.object({
  scope: z.enum(["all", "older_than_30_days"]),
});

export const archiveRoutes = new Hono();
archiveRoutes.use("*", requireAuth);

// Arxivni butunlay tozalash (qaytarib bo'lmaydi) - "all" hozir hammasini,
// "older_than_30_days" faqat 30 kundan oldin arxivlanganlarni o'chiradi.
archiveRoutes.post("/purge", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = purgeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Tozalash turi noto'g'ri (all yoki older_than_30_days)" }, 400);
  }
  try {
    return c.json(await purgeArchive(parsed.data.scope));
  } catch (err) {
    console.error(err);
    return c.json({ error: "Arxivni tozalashda xatolik yuz berdi" }, 500);
  }
});
