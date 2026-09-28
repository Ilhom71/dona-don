import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { smsAdmins } from "../../db/schema";
import { verifyPassword } from "../auth/service";
import { createToken, SESSION_MAX_AGE_SECONDS } from "../../utils/jwt";
import { requireSmsAdminAuth } from "../../middleware/sms-admin-auth";
import { getSmsBalance, getSmsCreditHistory, topupSmsCredits, SMS_PRICE_UZS } from "./credit-service";

// MUHIM: bu router `/sms-admin` (alohida top-level prefiks) ga ulanadi,
// `/sms`ga EMAS - CLAUDE.md qoidasiga ko'ra (`smsRoutes.use("*", requireAuth)`
// bilan tartib nizosiga tushib qolmasligi uchun, xuddi global "/*"
// middleware muammosi kabi).
export const smsAdminRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(1, "Login kiritilishi shart"),
  password: z.string().min(1, "Parol kiritilishi shart"),
});

smsAdminRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Login yoki parol noto'g'ri kiritildi" }, 400);
  }

  const { username, password } = parsed.data;
  const [admin] = await db.select().from(smsAdmins).where(eq(smsAdmins.username, username)).limit(1);
  if (!admin) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    return c.json({ error: "Login yoki parol xato" }, 401);
  }

  const token = await createToken({ sub: admin.id, username: admin.username, scope: "sms_admin" });
  setCookie(c, "sms_admin_token", token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.json({ username: admin.username });
});

smsAdminRoutes.post("/logout", (c) => {
  deleteCookie(c, "sms_admin_token", { path: "/" });
  return c.json({ ok: true });
});

// ---------- Pastdagilar faqat SMS Admin sessiyasi bilan ochiladi ----------
const protectedRoutes = new Hono();
protectedRoutes.use("*", requireSmsAdminAuth);

protectedRoutes.get("/me", (c) => {
  return c.json({ smsAdminId: c.get("smsAdminId" as never) as string });
});

protectedRoutes.get("/credits", async (c) => {
  const [balance, history] = await Promise.all([getSmsBalance(), getSmsCreditHistory()]);
  return c.json({ balance, priceUzs: SMS_PRICE_UZS, history });
});

const topupSchema = z.object({
  quantity: z.number().int("Butun son bo'lishi kerak").positive("Musbat son bo'lishi kerak"),
  note: z.string().max(500).optional(),
});

protectedRoutes.post("/credits/topup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = topupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" }, 400);
  }
  const row = await topupSmsCredits(parsed.data.quantity, parsed.data.note);
  return c.json(row, 201);
});

smsAdminRoutes.route("/", protectedRoutes);
