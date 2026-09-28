import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../../db";
import { smsLogs } from "../../db/schema";
import { startOfTashkentMonth } from "../../utils/date";
import { sendTextupSms } from "./textup-client";
import { reserveSmsCredit, refundSmsCredit } from "./credit-service";
import { listPartnersWithBalance } from "../partners/service";

export type SendSmsInput = {
  partnerIds: string[];
};

export type SendSmsResultRow = {
  partnerId: string;
  partnerName: string;
  ok: boolean;
  error?: string;
};

/** Pul summasini "1 250 000" ko'rinishida guruhlaydi (SMS shablonlarida "som" so'zisiz - shablonda alohida bor). */
export function formatSmsAmount(value: number): string {
  const rounded = Math.round(value);
  return Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Yagona tasdiqlangan SMS shabloni (SMS bo'limidan qo'lda yuborishda) - erkin
 * matn yoki TextUP shablonlari ISHLATILMAYDI, faqat shu format har bir
 * hamkor uchun to'ldirib yuboriladi.
 */
function buildSmsMessage(partner: { name: string; phone: string; balanceUzs: number }): string {
  const phoneDigits = partner.phone.replace(/\D/g, "");
  return `Dona Don Group: Assalomu alaykum, hurmatli ${partner.name} aka. Ortamizdagi hisob: ${formatSmsAmount(partner.balanceUzs)} som. Tel:+${phoneDigits}`;
}

/**
 * BITTA hamkorga tayyor (allaqachon to'ldirilgan) matnni yuboradi - ichki SMS
 * balansini band qilish/qaytarish va `sms_logs`ga yozish shu yerda bajariladi.
 * Ham manual `sendSms()` (pastda), ham savdo modulidagi avtomatik xabar
 * (`backend/src/modules/sales/service.ts`) shu orqali yuboradi - kod
 * dublikatsiya qilinmaydi.
 */
export async function sendSingleSms(
  partner: { id: string; name: string; phone: string },
  message: string
): Promise<SendSmsResultRow> {
  // Yuborishdan OLDIN ichki SMS balansidan 1 ta "band qilinadi" - balans
  // tugagan bo'lsa TextUP'ga umuman so'rov yuborilmaydi (Admin bo'limidan
  // to'ldirmaguncha yuborib bo'lmaydi).
  const reserved = await reserveSmsCredit();
  if (!reserved) {
    const errorMessage = "SMS balansi tugagan - Admin bo'limidan to'ldiring";
    await db.insert(smsLogs).values({
      partnerId: partner.id,
      partnerName: partner.name,
      phone: partner.phone,
      message,
      status: "failed",
      errorMessage,
    });
    return { partnerId: partner.id, partnerName: partner.name, ok: false, error: errorMessage };
  }

  try {
    const { smsId } = await sendTextupSms(partner.phone, { message });
    await db.insert(smsLogs).values({
      partnerId: partner.id,
      partnerName: partner.name,
      phone: partner.phone,
      message,
      status: "sent",
      textupSmsId: smsId,
    });
    return { partnerId: partner.id, partnerName: partner.name, ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Noma'lum xatolik";
    // TextUP haqiqatda SMS yubormadi (xato qaytardi) - band qilingan kredit qaytariladi.
    await refundSmsCredit(`Yuborishda xato (${partner.name}): ${errorMessage}`);
    await db.insert(smsLogs).values({
      partnerId: partner.id,
      partnerName: partner.name,
      phone: partner.phone,
      message,
      status: "failed",
      errorMessage,
    });
    return { partnerId: partner.id, partnerName: partner.name, ok: false, error: errorMessage };
  }
}

/**
 * Tanlangan hamkorlarga (telefon raqami bor bo'lganlariga) belgilangan yagona
 * shablon bo'yicha SMS yuboradi. Har biriga ALOHIDA TextUP so'rovi yuboriladi
 * va natija (muvaffaqiyatli yoki xato) `sms_logs`ga alohida qator sifatida
 * yoziladi - biri xato bo'lsa ham qolganlari to'xtab qolmaydi.
 */
export async function sendSms(input: SendSmsInput): Promise<{ results: SendSmsResultRow[] }> {
  const partners = await listPartnersWithBalance();
  const selected = partners.filter((p) => input.partnerIds.includes(p.id));

  const results: SendSmsResultRow[] = [];

  for (const partner of selected) {
    if (!partner.phone) {
      results.push({
        partnerId: partner.id,
        partnerName: partner.name,
        ok: false,
        error: "Telefon raqami kiritilmagan",
      });
      continue;
    }

    const message = buildSmsMessage({ name: partner.name, phone: partner.phone, balanceUzs: partner.balanceUzs });
    results.push(await sendSingleSms({ id: partner.id, name: partner.name, phone: partner.phone }, message));
  }

  return { results };
}

/** SMS tarixi - eng yangisi tepada, ixtiyoriy hamkor/holat filtri bilan. */
export async function getSmsLogs(filters: { partnerId?: string; status?: "sent" | "failed" } = {}) {
  const conditions = [];
  if (filters.partnerId) conditions.push(eq(smsLogs.partnerId, filters.partnerId));
  if (filters.status) conditions.push(eq(smsLogs.status, filters.status));

  return db.query.smsLogs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(smsLogs.sentAt),
  });
}

/**
 * "Bu oy yuborilgan SMS soni" - TextUP hujjatida balans/limit endpointi
 * yo'qligi sababli, o'zimizning sms_logs jadvalimizdan hisoblanadi
 * (faqat muvaffaqiyatli yuborilganlar, joriy Toshkent oyi bo'yicha).
 */
export async function getSmsStats() {
  const monthStart = startOfTashkentMonth();
  const rows = await db.query.smsLogs.findMany({
    where: and(eq(smsLogs.status, "sent"), gte(smsLogs.sentAt, monthStart)),
  });
  return { sentThisMonth: rows.length };
}
