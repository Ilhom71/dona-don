import { sql } from "drizzle-orm";
import { db } from "../../db";

export type PurgeScope = "all" | "older_than_30_days";

export type PurgeResult = {
  scope: PurgeScope;
  deleted: Record<string, number>;
  // Bog'liq tarixiy yozuvlari (savdo/xarid/...) bor bo'lgani uchun o'chirib
  // bo'lmagan arxivlangan mahsulot/hamkor/omborlar soni.
  skipped: Record<string, number>;
};

/**
 * Arxivdagi ma'lumotlarni butunlay o'chiradi (foydalanuvchi so'rovi):
 *  - bekor qilingan savdo/xarid/to'lov/xarajat/kassa/ombor yozuvlari
 *  - arxivlangan mahsulot/hamkor/ombor - faqat hech qanday faol yozuv unga
 *    bog'lanmagan bo'lsa (aks holda tarixiy hisobotlar buzilardi, shuning
 *    uchun bunday yozuvlar arxivda qoladi va `skipped`da sanaladi).
 *
 * `scope`: "all" - hozir hammasini; "older_than_30_days" - faqat 30 kundan
 * oldin arxivlangan/bekor qilinganlarni. Hammasi bitta tranzaksiyada.
 * Jadval nomlari aniq (alias bilan) yozilgan - drizzle `${table.col}`
 * shadowing xavfi bo'lmasligi uchun (CLAUDE.md).
 */
export async function purgeArchive(scope: PurgeScope): Promise<PurgeResult> {
  const cutoffDate = scope === "all" ? new Date() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Raw sql ichida Date obyekti serializatsiya muammosi bo'lmasligi uchun ISO satr
  // (UTC) + aniq ::timestamp cast - drizzle ham timestamp ustunlarini shunday yozadi.
  const cutoff = sql`${cutoffDate.toISOString()}::timestamp`;
  const deleted: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // Bitta DELETE ... RETURNING 1 dan o'chirilgan qatorlar sonini oladi.
    const run = async (key: string, query: ReturnType<typeof sql>) => {
      const rows = await tx.execute(query);
      deleted[key] = (rows as unknown as unknown[]).length;
    };

    // 1) Bekor qilingan yozuvlar. Bog'liq jadvallar FK qoidalari bilan
    //    (cascade/set null) o'zi tozalanadi.
    await run(
      "sales",
      sql`delete from sales where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );
    await run(
      "purchases",
      sql`delete from purchases where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );
    await run(
      "payments",
      sql`delete from payments where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );
    await run(
      "expenses",
      sql`delete from expenses where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );
    await run(
      "cashTransactions",
      sql`delete from cash_transactions where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );
    await run(
      "stockMovements",
      sql`delete from stock_movements where cancelled_at is not null and cancelled_at < ${cutoff} returning 1`
    );

    // 2) Arxivlangan hamkorlar - faqat savdo/xarid/to'lovi qolmaganlar.
    await run(
      "partners",
      sql`delete from partners pa
          where pa.archived_at is not null and pa.archived_at < ${cutoff}
            and not exists (select 1 from sales s where s.partner_id = pa.id)
            and not exists (select 1 from purchases pu where pu.partner_id = pa.id)
            and not exists (select 1 from payments py where py.partner_id = pa.id)
          returning 1`
    );

    // 3) Arxivlangan mahsulotlar - faqat hech qanday savdo/xarid/ombor
    //    harakati/partiyasi qolmaganlar (product_stock cascade bilan o'chadi).
    await run(
      "products",
      sql`delete from products pr
          where pr.archived_at is not null and pr.archived_at < ${cutoff}
            and not exists (select 1 from sale_items si where si.product_id = pr.id)
            and not exists (select 1 from purchase_items pi where pi.product_id = pr.id)
            and not exists (select 1 from stock_movements sm where sm.product_id = pr.id)
            and not exists (select 1 from stock_lots sl where sl.product_id = pr.id)
          returning 1`
    );

    // 4) Arxivlangan omborlar - avval bo'sh (0 qoldiqli) qoldiq qatorlari
    //    olib tashlanadi, so'ng hech narsa bog'lanmaganlari o'chadi.
    await tx.execute(
      sql`delete from product_stock ps
          using warehouses w
          where ps.warehouse_id = w.id and ps.quantity = 0
            and w.archived_at is not null and w.archived_at < ${cutoff}`
    );
    await run(
      "warehouses",
      sql`delete from warehouses w
          where w.archived_at is not null and w.archived_at < ${cutoff}
            and not exists (select 1 from product_stock ps where ps.warehouse_id = w.id)
            and not exists (select 1 from sales s where s.warehouse_id = w.id)
            and not exists (select 1 from purchases pu where pu.warehouse_id = w.id)
            and not exists (select 1 from stock_lots sl where sl.warehouse_id = w.id)
          returning 1`
    );

    // O'chirilmay qolgan (bog'liq yozuvlari bor) arxivlanganlar soni.
    for (const [key, table] of [
      ["partners", "partners"],
      ["products", "products"],
      ["warehouses", "warehouses"],
    ] as const) {
      const rows = await tx.execute(
        sql`select count(*)::int as n from ${sql.raw(table)} where archived_at is not null and archived_at < ${cutoff}`
      );
      skipped[key] = Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }
  });

  return { scope, deleted, skipped };
}
