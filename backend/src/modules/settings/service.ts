import { desc } from "drizzle-orm";
import { db } from "../../db";
import { exchangeRates } from "../../db/schema";

/** Joriy USD/UZS kursini qaytaradi. Hech qanday kurs kiritilmagan bo'lsa xato tashlaydi. */
export async function getCurrentRate(): Promise<number> {
  const [latest] = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.createdAt))
    .limit(1);

  if (!latest) {
    throw new Error(
      "Valyuta kursi hali kiritilmagan. Avval Sozlamalar bo'limida USD/UZS kursini kiriting."
    );
  }

  return Number(latest.rate);
}

export async function setRate(rate: number) {
  const [row] = await db.insert(exchangeRates).values({ rate: String(rate) }).returning();
  return row;
}

export async function getRateHistory() {
  return db.select().from(exchangeRates).orderBy(desc(exchangeRates.createdAt)).limit(50);
}
