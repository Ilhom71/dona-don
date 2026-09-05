import { db } from "./index";
import { users, exchangeRates } from "./schema";
import { hashPassword } from "../modules/auth/service";

/**
 * Boshlang'ich ma'lumotlarni yaratadi: bitta admin foydalanuvchi va boshlang'ich
 * valyuta kursi. `bun run seed` orqali ishga tushiriladi, faqat bir marta kerak.
 */
async function seed() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const existing = await db.select().from(users).limit(1);
  if (existing.length === 0) {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({ username, passwordHash });
    console.log(`Admin foydalanuvchi yaratildi -> login: ${username}, parol: ${password}`);
    console.log("MUHIM: birinchi kirishdan so'ng parolni almashtiring.");
  } else {
    console.log("Foydalanuvchi allaqachon mavjud, o'tkazib yuborildi.");
  }

  const existingRate = await db.select().from(exchangeRates).limit(1);
  if (existingRate.length === 0) {
    const initialRate = process.env.INITIAL_USD_RATE ?? "12700";
    await db.insert(exchangeRates).values({ rate: initialRate });
    console.log(`Boshlang'ich USD/UZS kursi kiritildi: ${initialRate}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed xatosi:", err);
  process.exit(1);
});
