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

/**
 * To'lovni bekor qiladi - yozuv o'chirilmaydi/tahrirlanmaydi (immutable
 * ledger), faqat cancelledAt/cancelReason to'ldiriladi. Agar saleId bo'lsa,
 * o'sha savdoning paidAmountUzs/holati qaytadan hisoblanadi (bu to'lov
 * qo'shilgandagi teskarisi). Savdoning o'zi allaqachon bekor qilingan
 * (storno) bo'lsa, uning holati "cancelled" bo'lib qoladi - tegilmaydi.
 * Arxiv sahifasidan "Tiklash" bilan qaytariladi.
 */
export async function cancelPayment(id: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(payments).where(eq(payments.id, id));
    if (!existing) throw new Error("To'lov topilmadi");
    if (existing.cancelledAt) throw new Error("Bu to'lov allaqachon bekor qilingan");

    const [payment] = await tx
      .update(payments)
      .set({ cancelledAt: new Date(), cancelReason: reason ?? null })
      .where(eq(payments.id, id))
      .returning();

    if (existing.saleId) {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, existing.saleId)).for("update");
      if (sale && !sale.cancelledAt) {
        const newPaid = Number(sale.paidAmountUzs) - Number(existing.amountUzs);
        const status = newPaid <= 0 ? "credit" : newPaid >= Number(sale.totalAmountUzs) ? "paid" : "partial";
        await tx
          .update(sales)
          .set({ paidAmountUzs: String(newPaid), paymentStatus: status, updatedAt: new Date() })
          .where(eq(sales.id, existing.saleId));
      }
    }

    return payment;
  });
}

export async function restorePayment(id: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(payments).where(eq(payments.id, id));
    if (!existing) throw new Error("To'lov topilmadi");

    const [payment] = await tx
      .update(payments)
      .set({ cancelledAt: null, cancelReason: null })
      .where(eq(payments.id, id))
      .returning();

    if (existing.saleId) {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, existing.saleId)).for("update");
      if (sale && !sale.cancelledAt) {
        const newPaid = Number(sale.paidAmountUzs) + Number(existing.amountUzs);
        const status = newPaid <= 0 ? "credit" : newPaid >= Number(sale.totalAmountUzs) ? "paid" : "partial";
        await tx
          .update(sales)
          .set({ paidAmountUzs: String(newPaid), paymentStatus: status, updatedAt: new Date() })
          .where(eq(sales.id, existing.saleId));
      }
    }

    return payment;
  });
}
