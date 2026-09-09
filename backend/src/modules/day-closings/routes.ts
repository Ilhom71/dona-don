import { Hono } from "hono";
import { z } from "zod";
import {
  closeToday,
  listDayClosings,
  getLatestDayClosing,
  openToday,
  getTodayStatus,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const noteSchema = z.object({ note: z.string().nullable().optional() });

export const dayClosingRoutes = new Hono();
dayClosingRoutes.use("*", requireAuth);

dayClosingRoutes.get("/", async (c) => c.json(await listDayClosings()));
dayClosingRoutes.get("/latest", async (c) => c.json(await getLatestDayClosing()));
dayClosingRoutes.get("/status", async (c) => c.json(await getTodayStatus()));

dayClosingRoutes.post("/open", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const opening = await openToday(parsed.data.note);
    return c.json(opening, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

dayClosingRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const closing = await closeToday(parsed.data.note);
    return c.json(closing, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
