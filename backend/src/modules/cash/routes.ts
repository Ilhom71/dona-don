import { Hono } from "hono";
import { z } from "zod";
import {
  getCashLedger,
  getCashSummary,
  getAccountingLedger,
  getAccountingSummary,
  createCashTransaction,
  transferToAccounting,
  withdrawFromAccounting,
  cancelCashTransaction,
  restoreCashTransaction,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const cashTransactionSchema = z.object({
  direction: z.enum(["in", "out"]),
  amountUzs: z.number().positive("Summa musbat bo'lishi kerak"),
  note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
  partnerId: z.string().uuid().nullable().optional(),
});

const accountingTransferSchema = z.object({
  amountUzs: z.number().positive("Summa musbat bo'lishi kerak"),
  note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
});

const cancelSchema = z.object({ reason: z.string().nullable().optional() });

export const cashRoutes = new Hono();
cashRoutes.use("*", requireAuth);

cashRoutes.get("/ledger", async (c) => {
  const { from, to } = c.req.query();
  const rows = await getCashLedger({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(rows);
});

cashRoutes.get("/summary", async (c) => {
  const { from, to } = c.req.query();
  const summary = await getCashSummary({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
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

// ---------- Buxgalteriya (joriy hisob) ----------

cashRoutes.get("/accounting/ledger", async (c) => {
  const { from, to } = c.req.query();
  const rows = await getAccountingLedger({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(rows);
});

cashRoutes.get("/accounting/summary", async (c) => {
  const { from, to } = c.req.query();
  const summary = await getAccountingSummary({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(summary);
});

cashRoutes.post("/accounting/transfer-in", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = accountingTransferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const row = await transferToAccounting(parsed.data);
  return c.json(row, 201);
});

cashRoutes.post("/accounting/withdraw", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = accountingTransferSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const row = await withdrawFromAccounting(parsed.data);
  return c.json(row, 201);
});
