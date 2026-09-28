import { desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { smsCredits } from "../../db/schema";

// TextUP'da SMS narxi API orqali berilmagani uchun, dastur ichida qattiq
// belgilangan (foydalanuvchi bilan kelishilgan: 1 SMS = 200 so'm).
export const SMS_PRICE_UZS = 200;

/** Joriy ichki SMS balansi - barcha ledger yozuvlari (topup/usage/refund) yig'indisi. */
export async function getSmsBalance(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${smsCredits.amount}), 0)` })
    .from(smsCredits);
  return Number(row?.total ?? 0);
}

/** SMS kredit tarixi (topup/usage/refund) - eng yangisi tepada. */
export async function getSmsCreditHistory() {
  return db.select().from(smsCredits).orderBy(desc(smsCredits.createdAt)).limit(200);
}

/**
 * Admin tomonidan qo'lda SMS krediti qo'shadi (haqiqatda TextUP orqali sotib
 * olingandan KEYIN, shu yerga qo'lda kiritiladi - avtomatik to'lov yo'q).
 */
export async function topupSmsCredits(quantity: number, note?: string) {
  const totalUzs = quantity * SMS_PRICE_UZS;
  const [row] = await db
    .insert(smsCredits)
    .values({
      type: "topup",
      amount: quantity,
      pricePerSmsUzs: String(SMS_PRICE_UZS),
      totalUzs: String(totalUzs),
      note: note || null,
    })
    .returning();
  return row;
}

/**
 * Bitta SMS yuborish uchun kredit "band qiladi" (balansdan 1 ta kamaytiradi).
 * Race condition'dan himoyalanish uchun (CLAUDE.md: pul bilan bog'liq
 * operatsiyalar `.for("update")` yoki tenglashtiruvchi qulf bilan himoyalanadi)
 * - `pg_advisory_xact_lock` bilan tranzaksiya davomida qulflanadi, shu bilan
 * bir vaqtda ikkita yuborish balansni manfiyga tushirib qo'ymaydi.
 * Balans yetarli bo'lmasa `false` qaytaradi (hech narsa yozilmaydi).
 */
export async function reserveSmsCredit(): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Doimiy son (advisory lock kaliti) - shu SMS balans operatsiyalari uchun ajratilgan.
    await tx.execute(sql`select pg_advisory_xact_lock(778812345)`);
    const [row] = await tx
      .select({ total: sql<string>`coalesce(sum(${smsCredits.amount}), 0)` })
      .from(smsCredits);
    const balance = Number(row?.total ?? 0);
    if (balance <= 0) return false;
    await tx.insert(smsCredits).values({ type: "usage", amount: -1 });
    return true;
  });
}

/**
 * TextUP'ga yuborish AMALGA OSHMAGANDA (xato qaytarganda) - aslida hech qanday
 * SMS yuborilmagani uchun, oldin band qilingan kredit teskari yozuv bilan
 * qaytariladi (immutable ledger qoidasi - hech narsa o'chirilmaydi).
 */
export async function refundSmsCredit(note: string) {
  await db.insert(smsCredits).values({ type: "refund", amount: 1, note });
}
