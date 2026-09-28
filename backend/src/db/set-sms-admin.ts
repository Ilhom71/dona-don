import { eq } from "drizzle-orm";
import { db } from "./index";
import { smsAdmins } from "./schema";
import { hashPassword } from "../modules/auth/service";

/**
 * SMS Admin (kredit boshqaruv) login/parolini to'g'ridan-to'g'ri bazaga
 * o'rnatadi - .env orqali EMAS. Yangi login yaratadi yoki mavjudini
 * yangilaydi (parolni almashtirish uchun ham shu skript ishlatiladi).
 *
 * Ishlatish:
 *   bun run sms-admin:set -- <username> <password>
 */
async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error("Xatolik: username va password ko'rsatilishi shart.");
    console.error("Ishlatish: bun run sms-admin:set -- <username> <password>");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(smsAdmins).where(eq(smsAdmins.username, username)).limit(1);

  if (existing) {
    await db.update(smsAdmins).set({ passwordHash }).where(eq(smsAdmins.id, existing.id));
    console.log(`SMS Admin "${username}" paroli yangilandi.`);
  } else {
    await db.insert(smsAdmins).values({ username, passwordHash });
    console.log(`SMS Admin "${username}" yaratildi.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Xatolik:", err);
  process.exit(1);
});
