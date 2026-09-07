import { and, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { products, productStock, warehouses, sales, saleItems, payments, expenses } from "../../db/schema";
import { listPartnersWithBalance } from "../partners/service";

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
    })
    .from(productStock)
    .innerJoin(products, eq(productStock.productId, products.id))
    .innerJoin(warehouses, eq(productStock.warehouseId, warehouses.id))
    .where(sql`${products.archivedAt} is null and ${warehouses.archivedAt} is null`);

  // Bekor qilingan (storno) savdolar hisobotlarga kirmaydi.
  const [today] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(sql`${sales.saleDate}::date = current_date and ${sales.cancelledAt} is null`);

  const [month] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(
      sql`date_trunc('month', ${sales.saleDate}) = date_trunc('month', current_date) and ${sales.cancelledAt} is null`
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
      sql`date_trunc('month', ${sales.saleDate}) = date_trunc('month', current_date) and ${sales.cancelledAt} is null`
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
 * Buxgalteriya hisoboti: berilgan davr uchun daromad (savdo), tannarx, yalpi
 * va sof foyda, xarajatlar (kategoriya bo'yicha) va naqd pul oqimi. Bekor
 * qilingan (storno) savdolar hisobga kirmaydi. Qarzdorlik esa davrga bog'liq
 * emas - har doim "hozirgi holat" sifatida qaytariladi.
 */
export async function getAccountingReport(from: Date, to: Date) {
  // Muhim: sana oralig'ini solishtirishda drizzle'ning tipdagi `gte`/`lte`
  // funksiyalari ishlatiladi (raw `sql` shablon ichiga Date obyektini
  // to'g'ridan-to'g'ri qo'yish emas) - aks holda postgres drayveri "Date"
  // qiymatini параметр sifatida to'g'ri serializatsiya qila olmay, so'rov
  // xato bilan tugaydi (bu funksiya oldin shu sababdan doim 500 qaytargan).
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

  // "Yetkazib beruvchiga to'lov" (supplier_payment) kategoriyasi bu yerda
  // **chiqarib tashlanadi** - u haqiqiy "xarajat" emas, xarid uchun to'lov
  // (aktiv - naqd pul omborga aylanadi). Uning tannarxi allaqachon yuqoridagi
  // COGS'ga (costPriceUzsSnapshot) sotilgan paytda kiritiladi - agar bu yerda
  // ham "xarajat" sifatida ayirilsa, tannarx ikki marta hisoblanib, sof foyda
  // sun'iy ravishda kamayib ketardi (haqiqiy xarajatlarsiz ham "zarar"
  // ko'rsatib turishi mumkin edi).
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

  const [cashIn] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amountUzs}), 0)` })
    .from(payments)
    .where(and(gte(payments.paymentDate, from), lte(payments.paymentDate, to), isNull(payments.cancelledAt)));

  // Naqd pul oqimi (cash flow) uchun esa yetkazib beruvchiga to'lov HAM
  // hisobga olinadi - bu haqiqiy pul chiqimi, garchi sof foydani kamaytiruvchi
  // "xarajat" sifatida hisoblanmasa ham (yuqoridagi izohga qarang).
  const [allExpensesCash] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amountUzs}), 0)` })
    .from(expenses)
    .where(
      and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to), isNull(expenses.cancelledAt))
    );

  // Hamkorlar sahifasi bilan bir xil manba (listPartnersWithBalance) - Kassa
  // orqali qo'lda kiritilgan hamkor to'lovlarini ham hisobga oladi, davrga
  // bog'liq emas (har doim "hozirgi holat").
  const partnersForReceivables = await listPartnersWithBalance();
  const receivablesUzs = partnersForReceivables.reduce(
    (sum, p) => sum + Math.max(0, p.balanceUzs),
    0
  );

  const revenueUzs = Number(revenue?.revenueUzs ?? 0);
  const cogsUzs = Number(cogs?.cogsUzs ?? 0);
  const grossProfitUzs = revenueUzs - cogsUzs;
  const expensesUzs = expenseRows.reduce((sum, r) => sum + Number(r.totalUzs), 0);
  const netProfitUzs = grossProfitUzs - expensesUzs;
  const cashInUzs = Number(cashIn?.total ?? 0);
  const cashOutUzs = Number(allExpensesCash?.total ?? 0);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    revenueUzs,
    saleCount: Number(revenue?.saleCount ?? 0),
    cogsUzs,
    freightUzs: Number(cogs?.freightUzs ?? 0),
    grossProfitUzs,
    expensesUzs,
    expensesByCategory: expenseRows.map((r) => ({
      category: r.category,
      totalUzs: Number(r.totalUzs),
    })),
    netProfitUzs,
    cashInUzs,
    cashOutUzs,
    netCashFlowUzs: cashInUzs - cashOutUzs,
    receivablesUzs,
  };
}

/** Berilgan davr uchun kunlar bo'yicha savdo va daromad hisoboti. */
export async function getProfitReport(from: Date, to: Date) {
  return db
    .select({
      day: sql<string>`date(${sales.saleDate})`,
      salesUzs: sql<string>`sum(${sales.totalAmountUzs})`,
      profitUzs: sql<string>`sum(
        (case when ${sales.currency} = 'USD' then ${saleItems.unitPrice} * ${sales.exchangeRateSnapshot} else ${saleItems.unitPrice} end
          - ${saleItems.costPriceUzsSnapshot}) * ${saleItems.quantity}
      )`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(gte(sales.saleDate, from), lte(sales.saleDate, to), isNull(sales.cancelledAt)))
    .groupBy(sql`date(${sales.saleDate})`)
    .orderBy(sql`date(${sales.saleDate})`);
}
