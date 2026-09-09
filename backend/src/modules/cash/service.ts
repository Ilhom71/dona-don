import { eq } from "drizzle-orm";
import { db } from "../../db";
import { payments, expenses, cashTransactions } from "../../db/schema";

type CashAccount = "kassa" | "buxgalteriya";
// `transferToAccounting` boshqa (kattaroq) tranzaksiya ichida ham
// chaqirilishi mumkin (masalan kun yopishda) - shuning uchun `tx`ni
// tashqaridan qabul qiladi (stock/service.ts'dagi bilan bir xil naqsh).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  // Bekor qilingan yozuv ro'yxatda ko'rinadi (shaffoflik uchun), lekin
  // qoldiq/yig'indi hisob-kitoblariga kirmaydi.
  cancelled: boolean;
  balanceUzs: number;
};

/**
 * Bitta hisob ("kassa" yoki "buxgalteriya") bo'yicha to'liq harakat tarixi,
 * yuguruvchi qoldiq bilan. `payments`/`expenses` doim kunlik savdo kassasiga
 * tegishli bo'lgani uchun faqat "kassa" hisobida ko'rinadi - "buxgalteriya"
 * hisobida faqat qo'lda kiritilgan (`cash_transactions`, shu hisobga
 * tegishli) yozuvlar bo'ladi (masalan kassadan o'tkazma, pul chiqarish).
 *
 * Muhim: qoldiq (balanceUzs) har doim **butun tarix** bo'yicha hisoblanadi
 * (garchi natija `from`/`to` bilan filtrlansa ham) - aks holda filtrlangan
 * ro'yxatdagi "Qoldiq" ustuni haqiqiy qoldiqni emas, faqat shu davr ichidagi
 * farqni ko'rsatib, chalkashtirib yuboradi.
 */
async function getLedgerForAccount(
  account: CashAccount,
  filters: { from?: Date; to?: Date } = {}
): Promise<CashLedgerRow[]> {
  const manualRows = await db.query.cashTransactions.findMany({
    where: (t, { eq }) => eq(t.account, account),
    with: { partner: true },
  });

  const all: Omit<CashLedgerRow, "balanceUzs">[] = [];

  if (account === "kassa") {
    const paymentRows = await db.query.payments.findMany({ with: { partner: true } });
    const expenseRows = await db.query.expenses.findMany({ with: { partner: true } });

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

  // Bekor qilingan yozuvlar ro'yxatda ko'rinadi, lekin qoldiqqa qo'shilmaydi.
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

/** Kassa (kunlik savdo) hisobining harakati - eski nom, xatti-harakati saqlanib qolgan. */
export async function getCashLedger(filters: { from?: Date; to?: Date } = {}) {
  return getLedgerForAccount("kassa", filters);
}

/** Buxgalteriya (firmaning joriy hisobi) harakati. */
export async function getAccountingLedger(filters: { from?: Date; to?: Date } = {}) {
  return getLedgerForAccount("buxgalteriya", filters);
}

/**
 * Bitta hisob yig'indisi: `currentBalanceUzs` har doim **hozirgi (butun
 * tarix)** qoldiq, `periodInUzs`/`periodOutUzs` esa faqat berilgan davr
 * bo'yicha kirim/chiqim yig'indisi (davr berilmasa - butun tarix bo'yicha).
 */
async function getSummaryForAccount(
  account: CashAccount,
  filters: { from?: Date; to?: Date } = {}
) {
  const fullLedger = await getLedgerForAccount(account, {});
  const currentBalanceUzs = fullLedger.at(-1)?.balanceUzs ?? 0;

  const period = (
    filters.from || filters.to ? await getLedgerForAccount(account, filters) : fullLedger
  ).filter((r) => !r.cancelled);
  const periodInUzs = period.filter((r) => r.direction === "in").reduce((s, r) => s + r.amountUzs, 0);
  const periodOutUzs = period.filter((r) => r.direction === "out").reduce((s, r) => s + r.amountUzs, 0);

  return { currentBalanceUzs, periodInUzs, periodOutUzs };
}

export async function getCashSummary(filters: { from?: Date; to?: Date } = {}) {
  return getSummaryForAccount("kassa", filters);
}

export async function getAccountingSummary(filters: { from?: Date; to?: Date } = {}) {
  return getSummaryForAccount("buxgalteriya", filters);
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
 * Kassadan buxgalteriya (joriy hisob)ga pul o'tkazadi - bitta amalda ikkita
 * bog'liq yozuv yaratiladi: kassadan chiqim + buxgalteriyaga kirim. Shu bilan
 * kassaning haqiqiy naqd qoldig'i kamayadi va joriy hisob qoldig'i oshadi -
 * ikkalasi ham har doim bir-biriga mos (dinamik, alohida hisoblanmaydi).
 * `tx` chaqiruvchi tomonidan beriladi (kerak bo'lsa `db.transaction(...)`
 * bilan ochib) - shu bilan bu funksiya kattaroq tranzaksiyaning bir qismi
 * sifatida ham (masalan kun yopish - qulflash bilan) ishlatilishi mumkin.
 */
export async function transferToAccounting(tx: Tx, input: { amountUzs: number; note: string }) {
  // Ikkala yozuv bitta `transferGroupId` bilan bog'lanadi - shunda bittasi
  // bekor qilinganda ikkinchisi ham avtomatik bekor qilinadi (aks holda
  // faqat bitta tomon bekor bo'lib, kassa/buxgalteriya qoldig'i mos kelmay qoladi).
  const transferGroupId = crypto.randomUUID();
  const [out] = await tx
    .insert(cashTransactions)
    .values({
      direction: "out",
      account: "kassa",
      amountUzs: String(input.amountUzs),
      note: `Buxgalteriyaga o'tkazma: ${input.note}`,
      transferGroupId,
    })
    .returning();
  const [inRow] = await tx
    .insert(cashTransactions)
    .values({
      direction: "in",
      account: "buxgalteriya",
      amountUzs: String(input.amountUzs),
      note: `Kassadan o'tkazma: ${input.note}`,
      transferGroupId,
    })
    .returning();
  return { out, in: inRow };
}

/**
 * Buxgalteriya (joriy hisob)dan pul chiqarish - masalan egasi rasmiy
 * hisobdan mablag' oldi yoki bank orqali chiqim qildi. Faqat buxgalteriya
 * hisobiga tegishli, kassaga taalluqli emas.
 */
export async function withdrawFromAccounting(input: {
  amountUzs: number;
  note: string;
  method?: "cash" | "card" | "bank";
  bankAccount?: string | null;
}) {
  const [row] = await db
    .insert(cashTransactions)
    .values({
      direction: "out",
      account: "buxgalteriya",
      amountUzs: String(input.amountUzs),
      method: input.method ?? "cash",
      bankAccount: input.method === "bank" ? input.bankAccount ?? null : null,
      note: input.note,
    })
    .returning();
  return row;
}

/**
 * Qo'lda kiritilgan kassa yozuvini bekor qiladi - o'chirilmaydi, faqat
 * cancelledAt/cancelReason to'ldiriladi (immutable ledger). Kassa
 * qoldig'idan chiqarib tashlanadi. Arxiv sahifasidan "Tiklash" bilan
 * qaytariladi.
 *
 * Agar yozuv kassa->buxgalteriya o'tkazmaning bir tomoni bo'lsa
 * (`transferGroupId` bor), ikkinchi tomoni ham birga bekor qilinadi -
 * aks holda faqat bitta hisobning qoldig'i tuzatilib, ikkinchisi eskicha
 * qolib ketardi (kassa/buxgalteriya orasida mos kelmaslik).
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
