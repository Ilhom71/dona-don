import { and, eq, gt } from "drizzle-orm";
import { db } from "./index";
import { productStock, stockLots } from "./schema";

/**
 * FIFO partiya tizimiga o'tishda, omborlarda turgan mavjud qoldiqni har bir
 * mahsulot/ombor uchun bitta "boshlang'ich partiya" (joriy avgCostUzs narxi
 * bilan) sifatida yozib qo'yadi - shundan keyingi barcha kirim (xarid/
 * qo'lda/transfer) o'zining alohida partiyasini yaratadi
 * (backend/src/modules/stock/service.ts).
 *
 * To'liq idempotent (agar biror mahsulot/ombor uchun allaqachon partiya
 * bo'lsa, o'tkazib yuboriladi) - shuning uchun `package.json`dagi
 * `db:migrate` skriptining bir qismi sifatida **har safar** ishga tushadi
 * (birinchi muvaffaqiyatli ishlashdan keyin keyingilari hech narsa
 * qilmaydi). Bu qadam yo'q bo'lib qolsa - migratsiyadan keyin mavjud
 * qoldiq uchun stock_lots bo'sh qoladi va birinchi savdo/chiqim "yetarli
 * mahsulot yo'q" xatosi bilan to'xtaydi (garchi ombordagi haqiqiy qoldiq
 * yetarli bo'lsa ham).
 */
async function backfill() {
  const rows = await db.select().from(productStock).where(gt(productStock.quantity, "0"));

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await db
      .select({ id: stockLots.id })
      .from(stockLots)
      .where(and(eq(stockLots.productId, row.productId), eq(stockLots.warehouseId, row.warehouseId)))
      .limit(1);

    if (existing.length) {
      skipped++;
      continue;
    }

    await db.insert(stockLots).values({
      productId: row.productId,
      warehouseId: row.warehouseId,
      unitCostUzs: row.avgCostUzs,
      quantity: row.quantity,
      remainingQuantity: row.quantity,
      source: "manual",
      receivedAt: new Date(),
    });
    created++;
  }

  console.log(`Boshlang'ich partiyalar: ${created} ta yaratildi, ${skipped} ta o'tkazib yuborildi.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill xatosi:", err);
  process.exit(1);
});
