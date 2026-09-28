import { and, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { products, productStock, warehouses, sales, saleItems, payments, expenses } from "../../db/schema";
import { listPartnersWithBalance } from "../partners/service";

// Timestamps are stored in UTC (timestamp without time zone); business days are
// Asia/Tashkent days. These fragments convert a stored column to Tashkent local time.
const TZ_LOCAL = (col: unknown) => sql`(${col} at time zone 'UTC' at time zone 'Asia/Tashkent')`;
// Current Tashkent local timestamp (replaces current_date, which follows the DB server zone).
const TASHKENT_NOW = sql`(now() at time zone 'Asia/Tashkent')`;

/** Bosh sahifa (dashboard) uchun umumiy ko'rsatkichlar. */
export async function getDashboardSummary() {
  // `product_stock`dan to'g'ridan-to'g'ri hisoblanadi (products.stockQuantity/
  // avgCostUzs'dagi tayyor yig'indidan emas) - shunda arxivlangan mahsulot
  // YOKI arxivlangan ombordagi qoldiq bu qiymatga kirmaydi. Ombor arxivlansa
  // ham (mahsulot qoldig'i o'zi o'zgarmasa-da), u yerdagi qiymat endi "faol"
  // hisoblanmaydi va bosh sahifadagi umumiy qiymatdan chiqadi.
  const [stockValue] = await db
    .select({
      value: sql<string>`coalesce(sum(${productStock.quantity} * ${productStock.avgCostUzs}), 0)`,
      // Ombordagi yuk og'irligi, hammasi kg'ga o'girilgan (ton = 1000 kg) -
      // Kassa bosh sahifasidagi "Ombordagi yuk" kartasi uchun.
      weightKg: sql<string>`coalesce(sum(case when ${products.unit} = 'ton' then ${productStock.quantity} * 1000 else ${productStock.quantity} end), 0)`,
    })
    .from(productStock)
    .innerJoin(products, eq(productStock.productId, products.id))
    .innerJoin(warehouses, eq(productStock.warehouseId, warehouses.id))
    .where(sql`${products.archivedAt} is null and ${warehouses.archivedAt} is null`);

  // Bekor qilingan (storno) savdolar hisobotlarga kirmaydi.
  const [today] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(sql`${TZ_LOCAL(sales.saleDate)}::date = ${TASHKENT_NOW}::date and ${sales.cancelledAt} is null`);

  const [month] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(
      sql`date_trunc('month', ${TZ_LOCAL(sales.saleDate)}) = date_trunc('month', ${TASHKENT_NOW}) and ${sales.cancelledAt} is null`
    );

  const [monthProfit] = await db
    .select({
      profit: sql<string>`coalesce(sum(
        (case when ${sales.currency} = 'USD' then ${saleItems.unitPrice} * ${sales.exchangeRateSnapshot} else ${saleItems.unitPrice} end
          - ${saleItems.costPriceUzsSnapshot}) * ${saleItems.quantity}
      ), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${saleItems.saleId} = ${sales.id}`)
    .where(
      sql`date_trunc('month', ${TZ_LOCAL(sales.saleDate)}) = date_trunc('month', ${TASHKENT_NOW}) and ${sales.cancelledAt} is null`
    );

  // Hamkorlar sahifasidagi bilan **bir xil** manba (listPartnersWithBalance)
  // ishlatiladi - shunda mijoz to'lov qilganda (rasmiy to'lov orqali ham,
  // Kassadagi qo'lda hamkor tanlab kiritilgan naqd kirim/chiqim orqali ham)
  // bu raqam ham darhol to'g'ri yangilanadi. Faqat musbat balanslar
  // (hamkor bizga qarzdor) qo'shiladi - manfiylari (biz qarzdormiz) bu
  // ko'rsatkichga kirmaydi, chunki bu "mijozlar qarzdorligi", boshqa narsa emas.
  const partnersForDebt = await listPartnersWithBalance();
  const totalDebtUzs = partnersForDebt.reduce((sum, p) => sum + Math.max(0, p.balanceUzs), 0);

  // Faqat faol (arxivlanmagan) omborlardagi qoldiq hisobga olinadi - shu
  // sababdan "hozirgi qoldiq" alohida hisoblanadi (products.stockQuantity
  // arxivlangan ombor qoldig'ini ham o'z ichiga oladi).
  const activeStockByProduct = db
    .select({
      productId: productStock.productId,
      activeQty: sql<string>`sum(${productStock.quantity})`.as("active_qty"),
    })
    .from(productStock)
    .innerJoin(warehouses, eq(productStock.warehouseId, warehouses.id))
    .where(sql`${warehouses.archivedAt} is null`)
    .groupBy(productStock.productId)
    .as("active_stock_by_product");

  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      unit: products.unit,
      minStockAlert: products.minStockAlert,
      avgCostUzs: products.avgCostUzs,
      sellingPriceUzs: products.sellingPriceUzs,
      notes: products.notes,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      stockQuantity: sql<string>`coalesce(${activeStockByProduct.activeQty}, 0)`,
    })
    .from(products)
    .leftJoin(activeStockByProduct, eq(activeStockByProduct.productId, products.id))
    .where(
      sql`${products.archivedAt} is null and ${products.minStockAlert} is not null and coalesce(${activeStockByProduct.activeQty}, 0) <= ${products.minStockAlert}`
    );

  // Bu so'rovlarning barchasi GROUP BY'siz agregat funksiyalar (sum/count),
  // shuning uchun jadval bo'sh bo'lsa ham har doim aynan bitta qator qaytaradi.
  return {
    stockValueUzs: Number(stockValue?.value ?? 0),
    stockWeightKg: Number(stockValue?.weightKg ?? 0),
    todaySalesUzs: Number(today?.total ?? 0),
    todaySalesCount: Number(today?.count ?? 0),
    monthSalesUzs: Number(month?.total ?? 0),
    monthSalesCount: Number(month?.count ?? 0),
    monthProfitUzs: Number(monthProfit?.profit ?? 0),
    totalDebtUzs,
    lowStockProducts: lowStock,
  };
}


/**
 * Totals used for both the current and the previous comparison period:
 * revenue (incl. freight), COGS, freight, expenses by category (supplier
 * payments excluded - see below) and the resulting profit. Freight money
 * belongs to us, so it stays inside revenue and does not change profit;
 * it is reported separately only for information.
 */
async function computePeriodTotals(from: Date, to: Date) {
  // Note: date ranges use drizzle's typed gte/lte (not a Date inside a raw
  // sql template), otherwise the postgres driver cannot serialize the param.
  const [revenue] = await db
    .select({
      revenueUzs: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`,
      saleCount: sql<string>`count(*)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, from), lte(sales.saleDate, to), isNull(sales.cancelledAt)));

  const [cogs] = await db
    .select({
      cogsUzs: sql<string>`coalesce(sum(${saleItems.costPriceUzsSnapshot} * ${saleItems.quantity}), 0)`,
      freightUzs: sql<string>`coalesce(sum(${saleItems.freightCostUzs}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, from), lte(sales.saleDate, to), isNull(sales.cancelledAt)));

  // "Yetkazib beruvchiga to'lov" (supplier_payment) is excluded here: it is a
  // purchase payment, not an expense (its cost already enters COGS when sold).
  const expenseRows = await db
    .select({
      category: expenses.category,
      totalUzs: sql<string>`coalesce(sum(${expenses.amountUzs}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, from),
        lte(expenses.expenseDate, to),
        isNull(expenses.cancelledAt),
        ne(expenses.category, "supplier_payment")
      )
    )
    .groupBy(expenses.category);

  const revenueUzs = Number(revenue?.revenueUzs ?? 0);
  const cogsUzs = Number(cogs?.cogsUzs ?? 0);
  const expensesUzs = expenseRows.reduce((sum, r) => sum + Number(r.totalUzs), 0);
  const grossProfitUzs = revenueUzs - cogsUzs;
  return {
    revenueUzs,
    saleCount: Number(revenue?.saleCount ?? 0),
    cogsUzs,
    freightUzs: Number(cogs?.freightUzs ?? 0),
    grossProfitUzs,
    expensesUzs,
    expenseRows,
    netProfitUzs: grossProfitUzs - expensesUzs,
  };
}

/**
 * Buxgalteriya hisoboti: berilgan davr uchun daromad (savdo, yuk puli bilan),
 * tannarx, yalpi va sof foyda, xarajatlar (kategoriya bo'yicha) va naqd pul
 * oqimi. Bekor qilingan (storno) savdolar hisobga kirmaydi. Qarzdorlik esa
 * davrga bog'liq emas - har doim "hozirgi holat" sifatida qaytariladi.
 * `previous` - oldingi teng uzunlikdagi davr bilan solishtirish uchun.
 */
export async function getAccountingReport(from: Date, to: Date) {
  const current = await computePeriodTotals(from, to);

  // Previous period of the same length, ending right before `from`.
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  const prev = await computePeriodTotals(prevFrom, prevTo);

  const [cashIn] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amountUzs}), 0)` })
    .from(payments)
    .where(and(gte(payments.paymentDate, from), lte(payments.paymentDate, to), isNull(payments.cancelledAt)));

  // Cash flow includes supplier payments too - it is real money going out.
  const [allExpensesCash] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amountUzs}), 0)` })
    .from(expenses)
    .where(
      and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to), isNull(expenses.cancelledAt))
    );

  // Same source as the Partners page (listPartnersWithBalance); not period-bound.
  const partnersForReceivables = await listPartnersWithBalance();
  const receivablesUzs = partnersForReceivables.reduce(
    (sum, p) => sum + Math.max(0, p.balanceUzs),
    0
  );

  const cashInUzs = Number(cashIn?.total ?? 0);
  const cashOutUzs = Number(allExpensesCash?.total ?? 0);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    revenueUzs: current.revenueUzs,
    saleCount: current.saleCount,
    cogsUzs: current.cogsUzs,
    // Freight is part of revenue (our money); shown separately for information.
    freightUzs: current.freightUzs,
    grossProfitUzs: current.grossProfitUzs,
    expensesUzs: current.expensesUzs,
    expensesByCategory: current.expenseRows.map((r) => ({
      category: r.category,
      totalUzs: Number(r.totalUzs),
    })),
    netProfitUzs: current.netProfitUzs,
    cashInUzs,
    cashOutUzs,
    netCashFlowUzs: cashInUzs - cashOutUzs,
    receivablesUzs,
    previous: {
      from: prevFrom.toISOString(),
      to: prevTo.toISOString(),
      revenueUzs: prev.revenueUzs,
      cogsUzs: prev.cogsUzs,
      expensesUzs: prev.expensesUzs,
      netProfitUzs: prev.netProfitUzs,
    },
  };
}

/**
 * Profit report grouped by Tashkent day (or month). Sales, sale items and
 * expenses are aggregated in SEPARATE queries and merged in JS - joining
 * sales to sale_items would repeat each sale's total once per item and
 * double count revenue. profit = sales - cogs - expenses (freight is our
 * money, so it is not subtracted). Only periods with any activity are returned.
 */
export async function getProfitReport(from: Date, to: Date, groupBy: "day" | "month" = "day") {
  // sql.raw for the format literal: a bound parameter would make the SELECT and
  // GROUP BY expressions differ for postgres.
  const fmt = sql.raw(groupBy === "month" ? "'YYYY-MM'" : "'YYYY-MM-DD'");
  const bucket = (col: unknown) => sql<string>`to_char(${TZ_LOCAL(col)}, ${fmt})`;

  const salesRows = await db
    .select({
      day: bucket(sales.saleDate),
      salesUzs: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, from), lte(sales.saleDate, to), isNull(sales.cancelledAt)))
    .groupBy(bucket(sales.saleDate));

  const itemRows = await db
    .select({
      day: bucket(sales.saleDate),
      cogsUzs: sql<string>`coalesce(sum(${saleItems.costPriceUzsSnapshot} * ${saleItems.quantity}), 0)`,
      freightUzs: sql<string>`coalesce(sum(${saleItems.freightCostUzs}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, from), lte(sales.saleDate, to), isNull(sales.cancelledAt)))
    .groupBy(bucket(sales.saleDate));

  const expenseRows = await db
    .select({
      day: bucket(expenses.expenseDate),
      expensesUzs: sql<string>`coalesce(sum(${expenses.amountUzs}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        gte(expenses.expenseDate, from),
        lte(expenses.expenseDate, to),
        isNull(expenses.cancelledAt),
        ne(expenses.category, "supplier_payment")
      )
    )
    .groupBy(bucket(expenses.expenseDate));

  const byDay = new Map<
    string,
    { day: string; salesUzs: number; cogsUzs: number; freightUzs: number; expensesUzs: number; profitUzs: number }
  >();
  const slot = (day: string) => {
    let row = byDay.get(day);
    if (!row) {
      row = { day, salesUzs: 0, cogsUzs: 0, freightUzs: 0, expensesUzs: 0, profitUzs: 0 };
      byDay.set(day, row);
    }
    return row;
  };
  for (const r of salesRows) slot(r.day).salesUzs = Number(r.salesUzs);
  for (const r of itemRows) {
    const row = slot(r.day);
    row.cogsUzs = Number(r.cogsUzs);
    row.freightUzs = Number(r.freightUzs);
  }
  for (const r of expenseRows) slot(r.day).expensesUzs = Number(r.expensesUzs);

  return [...byDay.values()]
    .map((r) => ({ ...r, profitUzs: r.salesUzs - r.cogsUzs - r.expensesUzs }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
