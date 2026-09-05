import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { payments, sales } from "../../db/schema";
import { getCurrentRate } from "../settings/service";

type CreatePaymentInput = {
  partnerId: string;
  saleId?: string | null;
  amount: number;
  currency: "UZS" | "USD";
  method?: "cash" | "card" | "bank";
  notes?: string | null;
  paymentDate?: Date;
};

/** To'lov qayd etadi; agar saleId berilsa, o'sha savdoning to'langan summasi va holatini yangilaydi. */
export async function createPayment(input: CreatePaymentInput) {
  const rate = await getCurrentRate();
  const amountUzs = input.currency === "USD" ? input.amount * rate : input.amount;

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        partnerId: input.partnerId,
        saleId: input.saleId ?? null,
        amount: String(input.amount),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        amountUzs: String(amountUzs),
        method: input.method ?? "cash",
        notes: input.notes ?? null,
        paymentDate: input.paymentDate ?? new Date(),
      })
      .returning();

    if (input.saleId) {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, input.saleId)).for("update");
      if (sale) {
        const newPaid = Number(sale.paidAmountUzs) + amountUzs;
        const status = newPaid <= 0 ? "credit" : newPaid >= Number(sale.totalAmountUzs) ? "paid" : "partial";
        await tx
          .update(sales)
          .set({ paidAmountUzs: String(newPaid), paymentStatus: status, updatedAt: new Date() })
          .where(eq(sales.id, input.saleId));
      }
    }

    return payment;
  });
}

export async function listPayments(filters: { partnerId?: string; saleId?: string }) {
  const conditions = [];
  if (filters.partnerId) conditions.push(eq(payments.partnerId, filters.partnerId));
  if (filters.saleId) conditions.push(eq(payments.saleId, filters.saleId));

  return db
    .select()
    .from(payments)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payments.paymentDate));
}
