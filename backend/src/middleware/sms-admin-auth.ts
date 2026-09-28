import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../utils/jwt";

/**
 * SMS bo'limidagi "Admin" (SMS kredit to'ldirish) qismini himoya qiladi -
 * asosiy `requireAuth`dan MUSTAQIL: alohida cookie (`sms_admin_token`) va
 * alohida `scope` tekshiriladi, shuning uchun asosiy admin tokeni bilan bu
 * yerga kirib bo'lmaydi (va aksincha).
 */
export async function requireSmsAdminAuth(c: Context, next: Next) {
  const token = getCookie(c, "sms_admin_token");

  if (!token) {
    return c.json({ error: "SMS Admin sifatida avtorizatsiyadan o'tilmagan" }, 401);
  }

  try {
    const payload = await verifyToken(token);
    if (payload.scope !== "sms_admin") {
      return c.json({ error: "Token yaroqsiz" }, 401);
    }
    c.set("smsAdminId", payload.sub as string);
    await next();
  } catch {
    return c.json({ error: "Token yaroqsiz yoki muddati o'tgan" }, 401);
  }
}
