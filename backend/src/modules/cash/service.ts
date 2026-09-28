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
  partnerId: string | null;
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
  // Manual cash rows only: false means the row does not change partner debt.
  affectsPartnerBalance: boolean;
  // Manual cash rows only: "funding" = kassani to'ldirish uchun kiritilgan pul
  // ("Pul olib turish"), null = payment/expense qatorlari (ular uchun ma'nosiz).
  purpose: "regular" | "funding" | null;
  balanceUzs: number;
};

// Row kind used by the ledger filter: incoming money, outgoing money, or a
// non-returnable expense (any expense except supplier payments).
export type CashRowKind = "in" | "out" | "non_returnable";

export function cashRowKind(r: {
  direction: "in" | "out";
  source: "payment" | "expense" | "manual";
  category: string;
}): CashRowKind {
  if (r.direction === "in") return "in";
  if (r.source === "expense" && r.category !== "supplier_payment") return "non_returnable";
  return "out";
}

export type CashLedgerFilters = {
  from?: Date;
  to?: Date;
  partnerId?: string;
  method?: "cash" | "card" | "bank";
  kind?: CashRowKind;
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
  filters: CashLedgerFilters = {}
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
      partnerId: p.partnerId,
      partnerName: p.partner?.name ?? null,
      method: p.method,
      bankAccount: null,
      description: p.notes || "Mijozdan to'lov",
      amountUzs: Number(p.amountUzs),
      cancelled: !!p.cancelledAt,
      affectsPartnerBalance: true,
      purpose: null,
    });
  }

  for (const e of expenseRows) {
    all.push({
      id: e.id,
      date: e.expenseDate.toISOString(),
      direction: "out",
      source: "expense",
      category: e.category,
      partnerId: e.partnerId,
      partnerName: e.partner?.name ?? null,
      method: e.method,
      bankAccount: null,
      description: e.description,
      amountUzs: Number(e.amountUzs),
      cancelled: !!e.cancelledAt,
      // Faqat "supplier_payment" hamkor qarzini kamaytiradi - boshqa
      // xarajatlar (ijara, ish haqi va h.k.) hech qanday hamkor bilan
      // bog'liq qarzga ta'sir qilmaydi.
      affectsPartnerBalance: e.category === "supplier_payment",
      purpose: null,
    });
  }

  for (const m of manualRows) {
    all.push({
      id: m.id,
      date: m.transactionDate.toISOString(),
      direction: m.direction,
      source: "manual",
      // "funding" (Pul olib turish) yozuvlari ro'yxatda alohida yorliq bilan
      // ajratilishi uchun boshqa category qiymati beriladi.
      category: m.purpose === "funding" ? "funding" : "manual",
      partnerId: m.partnerId,
      partnerName: m.partner?.name ?? null,
      method: m.method,
      bankAccount: m.bankAccount,
      description: m.note,
      amountUzs: Number(m.amountUzs),
      cancelled: !!m.cancelledAt,
      affectsPartnerBalance: m.affectsPartnerBalance,
      purpose: m.purpose,
    });
  }

  all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Bekor qilingan yozuvlar ro'yxatda ko'rinadi (Arxiv uchun), lekin qoldiqqa qo'shilmaydi.
  let balance = 0;
  const withBalance: CashLedgerRow[] = all.map((r) => {
    if (!r.cancelled) balance += r.direction === "in" ? r.amountUzs : -r.amountUzs;
    return { ...r, balanceUzs: balance };
  });

  if (!filters.from && !filters.to && !filters.partnerId && !filters.method && !filters.kind) {
    return withBalance;
  }

  // Filters are applied AFTER the running balance is computed, so the balance
  // column always reflects the whole history, not just the filtered subset.
  return withBalance.filter((r) => {
    const d = new Date(r.date).getTime();
    if (filters.from && d < filters.from.getTime()) return false;
    if (filters.to && d > filters.to.getTime()) return false;
    if (filters.partnerId && r.partnerId !== filters.partnerId) return false;
    if (filters.method && r.method !== filters.method) return false;
    if (filters.kind && cashRowKind(r) !== filters.kind) return false;
    return true;
  });
}

/**
 * Kassa yig'indisi. `filters.to` berilsa, `currentBalanceUzs`/`totalExpensesUzs`/
 * `fundingBalanceUzs` **shu sanagacha** (kun oxirigacha) bo'lgan holatni
 * ko'rsatadi - "o'sha sanada kassa qancha edi" ko'rinishi uchun (Kassa
 * amaliyotlari sahifasidagi sana filtri shu orqali ishlaydi). `to` berilmasa -
 * hozirgi (butun tarix) holat. `periodInUzs`/`periodOutUzs` esa har doim
 * faqat berilgan **davr** (from-to oralig'i) bo'yicha kirim/chiqim yig'indisi
 * (davr berilmasa - butun tarix bo'yicha).
 */
export async function getCashSummary(filters: { from?: Date; to?: Date } = {}) {
  const fullLedger = await getCashLedger({});
  // Ledger sana bo'yicha o'suvchi tartibda kelgani uchun, `to`gacha bo'lgan
  // eng oxirgi qatorning qoldig'i - aynan o'sha sanadagi (kun oxiridagi)
  // to'g'ri kumulyativ qoldiq.
  const asOfRows = filters.to
    ? fullLedger.filter((r) => new Date(r.date).getTime() <= filters.to!.getTime())
    : fullLedger;
  const currentBalanceUzs = asOfRows.at(-1)?.balanceUzs ?? 0;

  const period = (
    filters.from || filters.to ? await getCashLedger(filters) : fullLedger
  ).filter((r) => !r.cancelled);
  const periodInUzs = period.filter((r) => r.direction === "in").reduce((s, r) => s + r.amountUzs, 0);
  const periodOutUzs = period.filter((r) => r.direction === "out").reduce((s, r) => s + r.amountUzs, 0);

  // Non-returnable expenses up to the "asOf" cutoff (cancelled rows excluded).
  // Supplier payments are debt settlements, not expenses, so they are not counted.
  const totalExpensesUzs = asOfRows
    .filter((r) => !r.cancelled && cashRowKind(r) === "non_returnable")
    .reduce((s, r) => s + r.amountUzs, 0);

  // Hali qaytarilmagan "Pul olib turish" summasi ("asOf" cutoff'gacha,
  // bekor qilinganlar hisobga kirmaydi). Faqat ma'lumot uchun - qozondagi
  // pul (currentBalanceUzs) hisobiga bu allaqachon kirgan, shuning uchun bu
  // qiymat unga qo'shilmaydi, faqat alohida ko'rsatiladi.
  const fundingBalanceUzs = asOfRows
    .filter((r) => !r.cancelled && r.purpose === "funding")
    .reduce((s, r) => s + (r.direction === "in" ? r.amountUzs : -r.amountUzs), 0);

  return { currentBalanceUzs, periodInUzs, periodOutUzs, totalExpensesUzs, fundingBalanceUzs };
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
  affectsPartnerBalance?: boolean;
  // "funding" = "Pul olib turish" (kassani to'ldirish) - hamkorga bog'lanmaydi,
  // qarzga ta'sir qilmaydi, foyda-zarar hisobotida ko'rinmaydi.
  purpose?: "regular" | "funding";
  // Used by Excel import to keep the original date of the record.
  transactionDate?: Date;
},
  // Optional transaction handle: lets Excel import write many rows atomically.
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db
) {
  const purpose = input.purpose ?? "regular";
  // "funding" yozuvlari hech qachon hamkorga/qarzga bog'lanmasin - bu
  // qiymatlar kiritilgan bo'lsa ham majburan tozalanadi (route validatsiyasi
  // buni oldindan rad etadi, lekin service darajasida ham himoya kerak).
  const partnerId = purpose === "funding" ? null : input.partnerId ?? null;
  const affectsPartnerBalance =
    purpose === "funding" ? false : input.affectsPartnerBalance ?? true;

  const [row] = await tx
    .insert(cashTransactions)
    .values({
      direction: input.direction,
      account: "kassa",
      amountUzs: String(input.amountUzs),
      note: input.note,
      partnerId,
      method: input.method ?? "cash",
      bankAccount: input.bankAccount ?? null,
      affectsPartnerBalance,
      purpose,
      transactionDate: input.transactionDate ?? new Date(),
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
