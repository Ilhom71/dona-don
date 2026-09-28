import { Hono } from "hono";
import { z } from "zod";
import {
  getCashLedger,
  getCashSummary,
  createCashTransaction,
  cancelCashTransaction,
  restoreCashTransaction,
} from "./service";
import { parseDateParam } from "../../utils/date";
import { requireAuth } from "../../middleware/auth";

const cashTransactionSchema = z
  .object({
    direction: z.enum(["in", "out"]),
    amountUzs: z.number().positive("Summa musbat bo'lishi kerak"),
    note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
    partnerId: z.string().uuid().nullable().optional(),
    method: z.enum(["cash", "card", "bank"]).optional(),
    bankAccount: z.string().nullable().optional(),
    // false = only a cash record, partner debt is not changed
    affectsPartnerBalance: z.boolean().optional(),
    // "funding" = "Pul olib turish" - kassani to'ldirish uchun kiritilgan pul.
    purpose: z.enum(["regular", "funding"]).optional(),
  })
  .refine((v) => v.purpose !== "funding" || !v.partnerId, {
    // Pul olib turish hech qachon hamkorga bog'lanmaydi - aks holda hamkor
    // qarziga tasodifan ta'sir qilib qo'yishi mumkin.
    message: "Pul olib turish hamkorga bog'lanmaydi",
    path: ["partnerId"],
  });

// Optional ledger filters (query string); invalid values are ignored.
const ledgerQuerySchema = z.object({
  partnerId: z.string().uuid().optional().catch(undefined),
  method: z.enum(["cash", "card", "bank"]).optional().catch(undefined),
  kind: z.enum(["in", "out", "non_returnable"]).optional().catch(undefined),
});

const cancelSchema = z.object({ reason: z.string().nullable().optional() });

export const cashRoutes = new Hono();
cashRoutes.use("*", requireAuth);

cashRoutes.get("/ledger", async (c) => {
  const { from, to, partnerId, method, kind } = c.req.query();
  const f = ledgerQuerySchema.parse({
    partnerId: partnerId || undefined,
    method: method || undefined,
    kind: kind || undefined,
  });
  const rows = await getCashLedger({
    from: parseDateParam(from),
    to: parseDateParam(to, { endOfDay: true }),
    ...f,
  });
  return c.json(rows);
});

cashRoutes.get("/summary", async (c) => {
  const { from, to } = c.req.query();
  const summary = await getCashSummary({
    from: parseDateParam(from),
    to: parseDateParam(to, { endOfDay: true }),
  });
  return c.json(summary);
});

cashRoutes.post("/transactions", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = cashTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const row = await createCashTransaction(parsed.data);
  return c.json(row, 201);
});

cashRoutes.post("/transactions/:id/cancel", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const row = await cancelCashTransaction(c.req.param("id"), parsed.data.reason);
    return c.json(row);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

cashRoutes.post("/transactions/:id/restore", async (c) => {
  try {
    const row = await restoreCashTransaction(c.req.param("id"));
    return c.json(row);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});
