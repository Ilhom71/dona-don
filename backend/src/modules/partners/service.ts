import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  partners,
  sales,
  saleItems,
  products,
  payments,
  purchases,
  purchaseItems,
  expenses,
  cashTransactions,
} from "../../db/schema";

/**
 * Hamkorlar ro'yxati + har biri uchun **umumiy** balans (UZS):
 * balance = (savdolar - to'lovlar) - (xaridlar - yetkazib beruvchiga to'lovlar)
 * Musbat balance = hamkor bizga qarzdor (mijoz sifatida sotib olgan, to'lamagan).
 * Manfiy balance = biz hamkorga qarzdormiz (undan xarid qilingan, to'lanmagan).
 *
 * Eslatma: bir nechta bir-ko'p bog'lanishni (sales, payments, purchases,
 * expenses) bitta JOIN'da yig'indilash qatorlarni ko'paytirib yuboradi
 * (fan-out), shuning uchun har biri alohida guruhlangan derived table
 * sifatida LEFT JOIN qilinadi.
 *
 * `filters.partnerId` berilsa - bitta hamkor uchun (arxivlangan bo'lsa ham,
 * masalan tarixiy hisob-varag'ini ko'rish uchun) qaytaradi; berilmasa -
 * faqat faol (arxivlanmagan) hamkorlar ro'yxati.
 */
export async function listPartnersWithBalance(filters: { partnerId?: string } = {}) {
  const salesTotals = db
    .select({
      partnerId: sales.partnerId,
      // Bekor qilingan (storno) savdolar qarzga kirmaydi.
      total: sql<string>`sum(${sales.totalAmountUzs})`.as("total_sales_uzs"),
    })
    .from(sales)
    .where(isNull(sales.cancelledAt))
    .groupBy(sales.partnerId)
    .as("sales_totals");

  const paymentTotals = db
    .select({
      partnerId: payments.partnerId,
      // Bekor qilingan to'lovlar hisobga kirmaydi.
      total: sql<string>`sum(${payments.amountUzs})`.as("total_paid_uzs"),
    })
    .from(payments)
    .where(isNull(payments.cancelledAt))
    .groupBy(payments.partnerId)
    .as("payment_totals");

  const purchaseTotals = db
    .select({
      partnerId: purchases.partnerId,
      // Bekor qilingan xaridlar (kelajakda qo'shilsa) qarzga kirmaydi.
      total: sql<string>`sum(${purchases.totalAmountUzs})`.as("total_purchases_uzs"),
    })
    .from(purchases)
    .where(isNull(purchases.cancelledAt))
    .groupBy(purchases.partnerId)
    .as("purchase_totals");

  const supplierPaymentTotals = db
    .select({
      partnerId: expenses.partnerId,
      total: sql<string>`sum(${expenses.amountUzs})`.as("total_supplier_paid_uzs"),
    })
    .from(expenses)
    // Bekor qilingan xarajatlar (to'lovlar) hisobga kirmaydi.
    .where(and(eq(expenses.category, "supplier_payment"), isNull(expenses.cancelledAt)))
    .groupBy(expenses.partnerId)
    .as("supplier_payment_totals");

  // Hamkor tanlangan qo'lda kassa kirim/chiqim yozuvlari ham balansga ta'sir
  // qiladi: naqd kirim (masalan hamkordan qarz qaytdi) mijoz qarzini
  // kamaytiradi (to'lovga o'xshab), naqd chiqim (masalan hamkorga qarz
  // qaytarildi) bizning qarzimizni kamaytiradi (yetkazib beruvchiga
  // to'lovga o'xshab).
  const manualCashTotals = db
    .select({
      partnerId: cashTransactions.partnerId,
      inTotal: sql<string>`sum(case when ${cashTransactions.direction} = 'in' then ${cashTransactions.amountUzs} else 0 end)`.as(
        "manual_cash_in_uzs"
      ),
      outTotal: sql<string>`sum(case when ${cashTransactions.direction} = 'out' then ${cashTransactions.amountUzs} else 0 end)`.as(
        "manual_cash_out_uzs"
      ),
    })
    .from(cashTransactions)
    .where(and(isNotNull(cashTransactions.partnerId), isNull(cashTransactions.cancelledAt)))
    .groupBy(cashTransactions.partnerId)
    .as("manual_cash_totals");

  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      phone: partners.phone,
      address: partners.address,
      type: partners.type,
      notes: partners.notes,
      createdAt: partners.createdAt,
      totalSalesUzs: sql<string>`coalesce(${salesTotals.total}, 0)`,
      totalPaidUzs: sql<string>`coalesce(${paymentTotals.total}, 0)`,
      totalPurchasesUzs: sql<string>`coalesce(${purchaseTotals.total}, 0)`,
      totalSupplierPaidUzs: sql<string>`coalesce(${supplierPaymentTotals.total}, 0)`,
      manualCashInUzs: sql<string>`coalesce(${manualCashTotals.inTotal}, 0)`,
      manualCashOutUzs: sql<string>`coalesce(${manualCashTotals.outTotal}, 0)`,
    })
    .from(partners)
    .leftJoin(salesTotals, eq(salesTotals.partnerId, partners.id))
    .leftJoin(paymentTotals, eq(paymentTotals.partnerId, partners.id))
    .leftJoin(purchaseTotals, eq(purchaseTotals.partnerId, partners.id))
    .leftJoin(supplierPaymentTotals, eq(supplierPaymentTotals.partnerId, partners.id))
    .leftJoin(manualCashTotals, eq(manualCashTotals.partnerId, partners.id))
    .where(filters.partnerId ? eq(partners.id, filters.partnerId) : isNull(partners.archivedAt))
    .orderBy(partners.name);

  return rows.map((r) => ({
    ...r,
    balanceUzs:
      Number(r.totalSalesUzs) -
      Number(r.totalPaidUzs) -
      Number(r.manualCashInUzs) -
      (Number(r.totalPurchasesUzs) - Number(r.totalSupplierPaidUzs) - Number(r.manualCashOutUzs)),
  }));
}

/**
 * Bitta hamkorni **balans bilan birga** qaytaradi (listPartnersWithBalance
 * bilan bir xil hisob-kitob). Ilgari bu funksiya faqat xom `partners`
 * qatorini qaytarardi (balansSiz) - shuning uchun hamkor hisob-varag'i
 * sahifasidagi (/savdo/hamkorlar/[id]) balans belgisi Hamkorlar ro'yxatidagi
 * bilan mos kelmasdi (masalan savdo bekor qilingandan keyin ham eski holicha
 * ko'rinardi).
 */
export async function getPartner(id: string) {
  const [partner] = await listPartnersWithBalance({ partnerId: id });
  return partner;
}

export async function createPartner(data: {
  name: string;
  phone?: string | null;
  address?: string | null;
  type: "customer" | "supplier" | "both";
  notes?: string | null;
}) {
  const [partner] = await db.insert(partners).values(data).returning();
  return partner;
}

export async function updatePartner(
  id: string,
  data: Partial<{
    name: string;
    phone: string | null;
    address: string | null;
    type: "customer" | "supplier" | "both";
    notes: string | null;
  }>
) {
  const [partner] = await db
    .update(partners)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(partners.id, id))
    .returning();
  return partner;
}

/** Arxivlangan (o'chirilgan) hamkorlar - "Arxiv" sahifasi uchun. */
export async function listArchivedPartners() {
  return db.select().from(partners).where(isNotNull(partners.archivedAt)).orderBy(partners.name);
}

/**
 * Hamkorni "o'chiradi" - yozuv o'chirilmaydi, arxivga o'tkaziladi (archivedAt).
 * Bu hamkorga bog'langan tarixiy savdo/xarid/to'lov yozuvlari buzilib
 * qolmasligi uchun. Arxiv sahifasidan tiklash mumkin.
 */
export async function deletePartner(id: string) {
  await db.update(partners).set({ archivedAt: new Date() }).where(eq(partners.id, id));
}

export async function restorePartner(id: string) {
  const [partner] = await db
    .update(partners)
    .set({ archivedAt: null })
    .where(eq(partners.id, id))
    .returning();
  return partner;
}

export type PartnerLedgerRow = {
  id: string;
  date: string;
  // delivery = biz mijozga sotgan mahsulot (qarzni oshiradi)
  // payment = mijozdan olingan to'lov (qarzni kamaytiradi)
  // purchase-delivery = biz shu hamkordan xarid qilgan mahsulot (bizning qarzimizni oshiradi)
  // supplier-payment = biz hamkorga to'lagan pul (bizning qarzimizni kamaytiradi)
  kind: "delivery" | "payment" | "purchase-delivery" | "supplier-payment";
  saleId: string | null;
  purchaseId: string | null;
  cancelled: boolean;
  productName: string | null;
  vehicleNumber: string | null;
  quantity: number | null;
  unit: string | null;
  pricePerUnit: number | null;
  goodsValueUzs: number | null;
  freightCostUzs: number | null;
  paidUzs: number | null;
  paymentMethod: string | null;
  balanceUzs: number;
};

/**
 * Bitta hamkor uchun sotilgan/xarid qilingan har bir mahsulot qatorini
 * (mashina raqami, kg, narx, yuk puli bilan) va har bir to'lovni sana bo'yicha
 * ketma-ket, o'sib/kamayib boruvchi qoldiq (balance) bilan qaytaradi -
 * image.png dagi hisob-varaq jadvaliga o'xshash ko'rinish uchun (frontend:
 * /savdo/hamkorlar/[id]). Bekor qilingan savdolarning mahsulot qatorlari
 * qarzga qo'shilmaydi (lekin ular bo'yicha avvalroq qilingan to'lovlar -
 * haqiqiy pul - qoldiqda qoladi).
 */
export async function getPartnerLedger(partnerId: string) {
  const items = await db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      productName: products.name,
      unit: products.unit,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      subtotal: saleItems.subtotal,
      freightCostUzs: saleItems.freightCostUzs,
      saleDate: sales.saleDate,
      vehicleNumber: sales.vehicleNumber,
      currency: sales.currency,
      exchangeRateSnapshot: sales.exchangeRateSnapshot,
      cancelledAt: sales.cancelledAt,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(eq(sales.partnerId, partnerId));

  const partnerPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.partnerId, partnerId));

  const purchaseItemRows = await db
    .select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId,
      productName: products.name,
      unit: products.unit,
      quantity: purchaseItems.quantity,
      unitPrice: purchaseItems.unitPrice,
      subtotal: purchaseItems.subtotal,
      freightCostUzs: purchaseItems.freightCostUzs,
      purchaseDate: purchases.purchaseDate,
      vehicleNumber: purchases.vehicleNumber,
      currency: purchases.currency,
      exchangeRateSnapshot: purchases.exchangeRateSnapshot,
      cancelledAt: purchases.cancelledAt,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchases.partnerId, partnerId));

  const supplierPayments = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.partnerId, partnerId), eq(expenses.category, "supplier_payment")));

  // Hamkor tanlangan qo'lda kassa kirim/chiqim yozuvlari - naqd kirim
  // to'lovga o'xshab (qarzni kamaytiradi), naqd chiqim yetkazib beruvchiga
  // to'lovga o'xshab (bizning qarzimizni kamaytiradi) hisoblanadi.
  const manualCashRows = await db
    .select()
    .from(cashTransactions)
    .where(eq(cashTransactions.partnerId, partnerId));

  const rows: Omit<PartnerLedgerRow, "balanceUzs">[] = [];

  for (const item of items) {
    const goodsValueUzs =
      item.currency === "USD"
        ? Number(item.subtotal) * Number(item.exchangeRateSnapshot)
        : Number(item.subtotal);
    rows.push({
      id: item.id,
      date: item.saleDate.toISOString(),
      kind: "delivery",
      saleId: item.saleId,
      purchaseId: null,
      cancelled: !!item.cancelledAt,
      productName: item.productName,
      vehicleNumber: item.vehicleNumber,
      quantity: Number(item.quantity),
      unit: item.unit,
      pricePerUnit: Number(item.unitPrice),
      goodsValueUzs,
      freightCostUzs: Number(item.freightCostUzs),
      paidUzs: null,
      paymentMethod: null,
    });
  }

  for (const p of partnerPayments) {
    rows.push({
      id: p.id,
      date: p.paymentDate.toISOString(),
      kind: "payment",
      saleId: p.saleId,
      purchaseId: null,
      cancelled: !!p.cancelledAt,
      productName: null,
      vehicleNumber: null,
      quantity: null,
      unit: null,
      pricePerUnit: null,
      goodsValueUzs: null,
      freightCostUzs: null,
      paidUzs: Number(p.amountUzs),
      paymentMethod: p.method,
    });
  }

  for (const item of purchaseItemRows) {
    const goodsValueUzs =
      item.currency === "USD"
        ? Number(item.subtotal) * Number(item.exchangeRateSnapshot)
        : Number(item.subtotal);
    rows.push({
      id: item.id,
      date: item.purchaseDate.toISOString(),
      kind: "purchase-delivery",
      saleId: null,
      purchaseId: item.purchaseId,
      cancelled: !!item.cancelledAt,
      productName: item.productName,
      vehicleNumber: item.vehicleNumber,
      quantity: Number(item.quantity),
      unit: item.unit,
      pricePerUnit: Number(item.unitPrice),
      goodsValueUzs,
      freightCostUzs: Number(item.freightCostUzs),
      paidUzs: null,
      paymentMethod: null,
    });
  }

  for (const e of supplierPayments) {
    rows.push({
      id: e.id,
      date: e.expenseDate.toISOString(),
      kind: "supplier-payment",
      saleId: null,
      purchaseId: null,
      cancelled: !!e.cancelledAt,
      productName: null,
      vehicleNumber: null,
      quantity: null,
      unit: null,
      pricePerUnit: null,
      goodsValueUzs: null,
      freightCostUzs: null,
      paidUzs: Number(e.amountUzs),
      paymentMethod: e.method,
    });
  }

  for (const m of manualCashRows) {
    rows.push({
      id: m.id,
      date: m.transactionDate.toISOString(),
      kind: m.direction === "in" ? "payment" : "supplier-payment",
      saleId: null,
      purchaseId: null,
      cancelled: !!m.cancelledAt,
      productName: null,
      vehicleNumber: null,
      quantity: null,
      unit: null,
      pricePerUnit: null,
      goodsValueUzs: null,
      freightCostUzs: null,
      paidUzs: Number(m.amountUzs),
      paymentMethod: "cash",
    });
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  const result: PartnerLedgerRow[] = rows.map((r) => {
    if (r.kind === "delivery" && !r.cancelled) {
      balance += (r.goodsValueUzs ?? 0) + (r.freightCostUzs ?? 0);
    } else if (r.kind === "payment" && !r.cancelled) {
      balance -= r.paidUzs ?? 0;
    } else if (r.kind === "purchase-delivery" && !r.cancelled) {
      balance -= (r.goodsValueUzs ?? 0) + (r.freightCostUzs ?? 0);
    } else if (r.kind === "supplier-payment" && !r.cancelled) {
      balance += r.paidUzs ?? 0;
    }
    return { ...r, balanceUzs: balance };
  });

  return result;
}
