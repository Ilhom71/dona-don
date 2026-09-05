import { sql } from "drizzle-orm";
import { db } from "../../db";
import { products, sales, saleItems } from "../../db/schema";

/** Bosh sahifa (dashboard) uchun umumiy ko'rsatkichlar. */
export async function getDashboardSummary() {
  const [stockValue] = await db
    .select({
      value: sql<string>`coalesce(sum(${products.stockQuantity} * ${products.avgCostUzs}), 0)`,
    })
    .from(products);

  const [today] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(sql`${sales.saleDate}::date = current_date`);

  const [month] = await db
    .select({ total: sql<string>`coalesce(sum(${sales.totalAmountUzs}), 0)`, count: sql<string>`count(*)` })
    .from(sales)
    .where(sql`date_trunc('month', ${sales.saleDate}) = date_trunc('month', current_date)`);

  const [monthProfit] = await db
    .select({
      profit: sql<string>`coalesce(sum(
        (case when ${sales.currency} = 'USD' then ${saleItems.unitPrice} * ${sales.exchangeRateSnapshot} else ${saleItems.unitPrice} end
          - ${saleItems.costPriceUzsSnapshot}) * ${saleItems.quantity}
      ), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${saleItems.saleId} = ${sales.id}`)
    .where(sql`date_trunc('month', ${sales.saleDate}) = date_trunc('month', current_date)`);

  const [debt] = await db
    .select({
      total: sql<string>`coalesce(sum(${sales.totalAmountUzs} - ${sales.paidAmountUzs}), 0)`,
    })
    .from(sales)
    .where(sql`${sales.paymentStatus} != 'paid'`);

  const lowStock = await db
    .select()
    .from(products)
    .where(sql`${products.minStockAlert} is not null and ${products.stockQuantity} <= ${products.minStockAlert}`);

  // Bu so'rovlarning barchasi GROUP BY'siz agregat funksiyalar (sum/count),
  // shuning uchun jadval bo'sh bo'lsa ham har doim aynan bitta qator qaytaradi.
  return {
    stockValueUzs: Number(stockValue?.value ?? 0),
    todaySalesUzs: Number(today?.total ?? 0),
    todaySalesCount: Number(today?.count ?? 0),
    monthSalesUzs: Number(month?.total ?? 0),
    monthSalesCount: Number(month?.count ?? 0),
    monthProfitUzs: Number(monthProfit?.profit ?? 0),
    totalDebtUzs: Number(debt?.total ?? 0),
    lowStockProducts: lowStock,
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
    .innerJoin(sales, sql`${saleItems.saleId} = ${sales.id}`)
    .where(sql`${sales.saleDate} between ${from} and ${to}`)
    .groupBy(sql`date(${sales.saleDate})`)
    .orderBy(sql`date(${sales.saleDate})`);
}
