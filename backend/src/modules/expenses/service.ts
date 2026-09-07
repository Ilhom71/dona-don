import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { expenses } from "../../db/schema";
import { getCurrentRate } from "../settings/service";

export type ExpenseCategory =
  | "supplier_payment"
  | "salary"
  | "rent"
  | "transport"
  | "utilities"
  | "other";

type CreateExpenseInput = {
  category: ExpenseCategory;
  partnerId?: string | null;
  amount: number;
  currency: "UZS" | "USD";
  method?: "cash" | "card" | "bank";
  description: string;
  expenseDate?: Date;
};

/**
 * Kassadan chiqim (xarajat) yozadi - ijara, ish haqi, yetkazib beruvchiga
 * to'lov va h.k. Bu yozuv boshqa ledger'lar kabi keyinchalik o'zgartirilmaydi;
 * xato bo'lsa teskari (manfiy emas, alohida tuzatuvchi) yozuv kiritiladi.
 *
 * Ixtiyoriy `tx` - boshqa moliyaviy operatsiya (masalan xarid yaratish) o'z
 * tranzaksiyasi ichidan chaqirsa, shu tranzaksiya berilishi kerak - aks holda
 * xarajat yozuvi alohida (bog'liq bo'lmagan) tranzaksiyada qo'shilib, asosiy
 * operatsiya keyinroq bekor bo'lsa (rollback) ham saqlanib qolgan bo'lardi.
 */
export async function createExpense(
  input: CreateExpenseInput,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db
) {
  const rate = await getCurrentRate();
  const amountUzs = input.currency === "USD" ? input.amount * rate : input.amount;

  const [expense] = await tx
    .insert(expenses)
    .values({
      category: input.category,
      partnerId: input.partnerId ?? null,
      amount: String(input.amount),
      currency: input.currency,
      exchangeRateSnapshot: String(rate),
      amountUzs: String(amountUzs),
      method: input.method ?? "cash",
      description: input.description,
      expenseDate: input.expenseDate ?? new Date(),
    })
    .returning();

  return expense;
}

export async function listExpenses(filters: {
  category?: ExpenseCategory;
  from?: Date;
  to?: Date;
}) {
  const conditions = [];
  if (filters.category) conditions.push(eq(expenses.category, filters.category));
  if (filters.from) conditions.push(gte(expenses.expenseDate, filters.from));
  if (filters.to) conditions.push(lte(expenses.expenseDate, filters.to));

  return db.query.expenses.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(expenses.expenseDate),
    with: { partner: true },
  });
}

/**
 * Xarajatni bekor qiladi - yozuv o'chirilmaydi/tahrirlanmaydi (immutable
 * ledger), faqat cancelledAt/cancelReason to'ldiriladi. Bekor qilingan
 * xarajat kassa qoldig'i va hamkor balansi hisob-kitoblaridan chiqarib
 * tashlanadi. Arxiv sahifasidan "Tiklash" bilan qaytariladi.
 */
export async function cancelExpense(id: string, reason?: string | null) {
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id));
  if (!existing) throw new Error("Xarajat topilmadi");
  if (existing.cancelledAt) throw new Error("Bu xarajat allaqachon bekor qilingan");

  const [expense] = await db
    .update(expenses)
    .set({ cancelledAt: new Date(), cancelReason: reason ?? null })
    .where(eq(expenses.id, id))
    .returning();
  return expense;
}

export async function restoreExpense(id: string) {
  const [expense] = await db
    .update(expenses)
    .set({ cancelledAt: null, cancelReason: null })
    .where(eq(expenses.id, id))
    .returning();
  return expense;
}
