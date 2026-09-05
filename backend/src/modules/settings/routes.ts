import { Hono } from "hono";
import { z } from "zod";
import { getCurrentRate, setRate, getRateHistory } from "./service";
import { requireAuth } from "../../middleware/auth";

export const settingsRoutes = new Hono();
settingsRoutes.use("*", requireAuth);

settingsRoutes.get("/exchange-rate", async (c) => {
  try {
    const rate = await getCurrentRate();
    return c.json({ rate });
  } catch (err) {
    return c.json({ rate: null, error: (err as Error).message });
  }
});

settingsRoutes.get("/exchange-rate/history", async (c) => {
  return c.json(await getRateHistory());
});

settingsRoutes.post("/exchange-rate", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ rate: z.number().positive() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Kurs musbat son bo'lishi kerak" }, 400);
  }
  const row = await setRate(parsed.data.rate);
  return c.json(row, 201);
});
