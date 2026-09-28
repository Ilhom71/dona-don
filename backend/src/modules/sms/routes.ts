import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { getSmsLogs, getSmsStats, sendSms } from "./service";
import { getSmsBalance } from "./credit-service";

// Erkin matn yoki TextUP shablonlari YO'Q - har bir hamkorga faqat yagona
// tasdiqlangan shablon (backend/src/modules/sms/service.ts'dagi buildSmsMessage)
// bo'yicha yuboriladi, shuning uchun bu yerda hamkorlar ro'yxatidan boshqa
// hech narsa kerak emas.
const sendSchema = z.object({
  partnerIds: z.array(z.string().uuid()).min(1, "Kamida bitta hamkor tanlanishi kerak"),
});

const logsQuerySchema = z.object({
  partnerId: z.string().uuid().optional(),
  status: z.enum(["sent", "failed"]).optional(),
});

export const smsRoutes = new Hono();
smsRoutes.use("*", requireAuth);

smsRoutes.post("/send", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" }, 400);
  }
  const result = await sendSms(parsed.data);
  return c.json(result);
});

smsRoutes.get("/logs", async (c) => {
  const { partnerId, status } = c.req.query();
  const parsed = logsQuerySchema.safeParse({
    partnerId: partnerId || undefined,
    status: status || undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "Noto'g'ri filtr parametri" }, 400);
  }
  const logs = await getSmsLogs(parsed.data);
  return c.json(logs);
});

smsRoutes.get("/stats", async (c) => {
  const stats = await getSmsStats();
  return c.json(stats);
});

// Ichki SMS balansi - oddiy foydalanuvchilar ham ko'ra oladi (yuborishdan
// oldin "qancha SMS qolgani"ni bilish uchun), lekin faqat Admin bo'limi
// orqali to'ldirish mumkin (alohida login talab qiladi - pastga qara).
smsRoutes.get("/balance", async (c) => {
  const balance = await getSmsBalance();
  return c.json({ balance });
});
