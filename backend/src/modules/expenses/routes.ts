import { Hono } from "hono";
import { z } from "zod";
import {
  createExpense,
  listExpenses,
  cancelExpense,
  restoreExpense,
  type ExpenseCategory,
} from "./service";
import { requireAuth } from "../../middleware/auth";

const expenseSchema = z.object({
  category: z.enum(["supplier_payment", "salary", "rent", "transport", "utilities", "other"]),
  partnerId: z.string().uuid().nullable().optional(),
  amount: z.number().positive("Summa musbat bo'lishi kerak"),
  currency: z.enum(["UZS", "USD"]).default("UZS"),
  method: z.enum(["cash", "card", "bank"]).optional(),
  description: z.string().min(1, "Tavsif kiritilishi shart"),
  expenseDate: z.coerce.date().optional(),
});

const cancelSchema = z.object({ reason: z.string().nullable().optional() });

export const expenseRoutes = new Hono();
expenseRoutes.use("*", requireAuth);

expenseRoutes.get("/", async (c) => {
  const { category, from, to } = c.req.query();
  const list = await listExpenses({
    category: ((category as ExpenseCategory) || undefined),
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return c.json(list);
});

expenseRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  const expense = await createExpense(parsed.data);
  return c.json(expense, 201);
});

expenseRoutes.post("/:id/cancel", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" }, 400);
  }
  try {
    const expense = await cancelExpense(c.req.param("id"), parsed.data.reason);
    return c.json(expense);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

expenseRoutes.post("/:id/restore", async (c) => {
  const expense = await restoreExpense(c.req.param("id"));
  if (!expense) return c.json({ error: "Xarajat topilmadi" }, 404);
  return c.json(expense);
});
