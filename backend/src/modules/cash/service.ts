import { eq } from "drizzle-orm";
import { db } from "../../db";
import { cashTransactions } from "../../db/schema";

export type CashLedgerRow = {
  id: string;
  date: string;
  direction: "in" | "out";
  // qaysi jadvaldan kelgani - bekor qilish/tiklash to'g'ri endpointga
  // yo'naltirilishi uchun. "payment" bekor qilinmaydi (savdoga bog'liq).
  source: "payment" | "expense" | "manual";
  // kirim uchun har doim "sale_payment", chiqim uchun expense.category
  category: string;
  partnerName: string | null;
  method: string;
  // method="bank" bo'lganda - aynan qaysi bank hisob raqamiga/dan
  // o'tkazilgani (faqat "manual" - qo'lda kiritilgan - yozuvlarda bo'ladi).
  bankAccount: string | null;
  description: string;
  amountUzs: number;
  // Bekor qilingan yozuv ro'yxatda ko'rinadi (Arxiv uchun), lekin
  // qoldiq/yig'indi hisob-kitoblariga kirmaydi.
  cancelled: boolean;
  balanceUzs: number;
};

/**
 * Kassaning to'liq harakat tarixi, yuguruvchi qoldiq bilan. Buxgalteriya
 * bo'limi olib tashlangan - endi barcha pul harakati bitta Kassada:
 * mijozdan to'lovlar, xarajatlar va qo'lda kiritilgan yozuvlar (eski
 * "buxgalteriya" hisobiga yozilgan yozuvlar ham shu yerda ko'rinadi).
 *
 * Eski kassa<->buxgalteriya ichki o'tkazmalari (`transferGroupId` bor)
 * ro'yxatdan chiqarib tashlanadi: ular bir-birini nolga tenglashtiradi
 * (kassadan chiqim + buxgalteriyaga kirim), shuning uchun umumiy qoldiq
 * o'zgarmaydi, faqat ro'yxatda keraksiz juft qator bo'lib turmaydi.
 *
 * Muhim: qoldiq (balanceUzs) har doim **butun tarix** bo'yicha hisoblanadi
 * (garchi natija `from`/`to` bilan filtrlansa ham) - aks holda filtrlangan
 * ro'yxatdagi "Qoldiq" ustuni haqiqiy qoldiqni emas, faqat shu davr ichidagi
 * farqni ko'rsatib, chalkashtirib yuboradi.
 */
export async function getCashLedger(
  filters: { from?: Date; to?: Date } = {}
): Promise<CashLedgerRow[]> {
  const manualRows = await db.query.cashTransactions.findMany({
    where: (t, { isNull }) => isNull(t.transferGroupId),
    with: { partner: true },
  });
  const paymentRows = await db.query.payments.findMany({ with: { partner: true } });
  const expenseRows = await db.query.expenses.findMany({ with: { partner: true } });

  const all: Omit<CashLedgerRow, "balanceUzs">[] = [];

  for (const p of paymentRows) {
    all.push({
      id: p.id,
      date: p.paymentDate.toISOString(),
      direction: "in",
      source: "payment",
      category: "sale_payment",
      partnerName: p.partner?.name ?? null,
      method: p.method,
      bankAccount: null,
      description: p.notes || "Mijozdan to'lov",
      amountUzs: Number(p.amountUzs),
      cancelled: !!p.cancelledAt,
    });
  }

  for (const e of expenseRows) {
    all.push({
      id: e.id,
      date: e.expenseDate.toISOString(),
      direction: "out",
      source: "expense",
      category: e.category,
      partnerName: e.partner?.name ?? null,
      method: e.method,
      bankAccount: null,
      description: e.description,
      amountUzs: Number(e.amountUzs),
      cancelled: !!e.cancelledAt,
    });
  }

  for (const m of manualRows) {
    all.push({
      id: m.id,
      date: m.transactionDate.toISOString(),
      direction: m.direction,
      source: "manual",
      category: "manual",
      partnerName: m.partner?.name ?? null,
      method: m.method,
      bankAccount: m.bankAccount,
      description: m.note,
      amountUzs: Number(m.amountUzs),
      cancelled: !!m.cancelledAt,
    });
  }

  all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Bekor qilingan yozuvlar ro'yxatda ko'rinadi (Arxiv uchun), lekin qoldiqqa qo'shilmaydi.
  let balance = 0;
  const withBalance: CashLedgerRow[] = all.map((r) => {
    if (!r.cancelled) balance += r.direction === "in" ? r.amountUzs : -r.amountUzs;
    return { ...r, balanceUzs: balance };
  });

  if (!filters.from && !filters.to) return withBalance;

  return withBalance.filter((r) => {
    const d = new Date(r.date).getTime();
    if (filters.from && d < filters.from.getTime()) return false;
    if (filters.to && d > filters.to.getTime()) return false;
    return true;
  });
}

/**
 * Kassa yig'indisi: `currentBalanceUzs` har doim **hozirgi (butun tarix)**
 * qoldiq, `periodInUzs`/`periodOutUzs` esa faqat berilgan davr bo'yicha
 * kirim/chiqim yig'indisi (davr berilmasa - butun tarix bo'yicha).
 */
export async function getCashSummary(filters: { from?: Date; to?: Date } = {}) {
  const fullLedger = await getCashLedger({});
  const currentBalanceUzs = fullLedger.at(-1)?.balanceUzs ?? 0;

  const period = (
    filters.from || filters.to ? await getCashLedger(filters) : fullLedger
  ).filter((r) => !r.cancelled);
  const periodInUzs = period.filter((r) => r.direction === "in").reduce((s, r) => s + r.amountUzs, 0);
  const periodOutUzs = period.filter((r) => r.direction === "out").reduce((s, r) => s + r.amountUzs, 0);

  return { currentBalanceUzs, periodInUzs, periodOutUzs };
}

/**
 * Kassaga qo'lda kirim/chiqim yozadi (masalan egasi naqd pul qo'shdi yoki
 * kassadan shaxsiy ehtiyoj uchun naqd oldi) - savdo/xarajat bilan bog'liq
 * bo'lmagan holatlar uchun, har doim izoh (sharh) bilan.
 */
export async function createCashTransaction(input: {
  direction: "in" | "out";
  amountUzs: number;
  note: string;
  partnerId?: string | null;
  method?: "cash" | "card" | "bank";
  bankAccount?: string | null;
}) {
  const [row] = await db
    .insert(cashTransactions)
    .values({
      direction: input.direction,
      account: "kassa",
      amountUzs: String(input.amountUzs),
      note: input.note,
      partnerId: input.partnerId ?? null,
      method: input.method ?? "cash",
      bankAccount: input.bankAccount ?? null,
    })
    .returning();
  return row;
}

/**
 * Qo'lda kiritilgan kassa yozuvini bekor qiladi - o'chirilmaydi, faqat
 * cancelledAt/cancelReason to'ldiriladi. Kassa qoldig'idan chiqarib
 * tashlanadi. Arxiv sahifasidan "Tiklash" bilan qaytariladi.
 *
 * Agar yozuv eski ichki o'tkazmaning bir tomoni bo'lsa (`transferGroupId`
 * bor), ikkinchi tomoni ham birga bekor qilinadi.
 */
export async function cancelCashTransaction(id: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    if (!existing) throw new Error("Yozuv topilmadi");
    if (existing.cancelledAt) throw new Error("Bu yozuv allaqachon bekor qilingan");

    const targetIds = existing.transferGroupId
      ? (
          await tx
            .select({ id: cashTransactions.id })
            .from(cashTransactions)
            .where(eq(cashTransactions.transferGroupId, existing.transferGroupId))
        ).map((r) => r.id)
      : [id];

    for (const targetId of targetIds) {
      await tx
        .update(cashTransactions)
        .set({ cancelledAt: new Date(), cancelReason: reason ?? null })
        .where(eq(cashTransactions.id, targetId));
    }

    const [row] = await tx.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    return row;
  });
}

export async function restoreCashTransaction(id: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    if (!existing) throw new Error("Yozuv topilmadi");

    const targetIds = existing.transferGroupId
      ? (
          await tx
            .select({ id: cashTransactions.id })
            .from(cashTransactions)
            .where(eq(cashTransactions.transferGroupId, existing.transferGroupId))
        ).map((r) => r.id)
      : [id];

    for (const targetId of targetIds) {
      await tx
        .update(cashTransactions)
        .set({ cancelledAt: null, cancelReason: null })
        .where(eq(cashTransactions.id, targetId));
    }

    const [row] = await tx.select().from(cashTransactions).where(eq(cashTransactions.id, id));
    return row;
  });
}
