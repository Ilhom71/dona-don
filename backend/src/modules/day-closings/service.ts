import { eq } from "drizzle-orm";
import { db } from "../../db";
import { dayClosings, dayOpenings } from "../../db/schema";
import { getCashSummary, transferToAccounting } from "../cash/service";
import { getDashboardSummary } from "../reports/service";

function todayKey() {
  // Server Asia/Tashkent (UTC+5)da ishlaydi (PLAN.md'da tasdiqlangan) -
  // MAHALLIY (local) Date getterlari ishlatiladi, chunki `toISOString()`
  // har doim UTC'ga o'giradi (server TZ'dan qat'i nazar) - Tashkent
  // vaqtida 00:00-04:59 oralig'ida bu kunni bir kun oldinga suzib
  // yuborardi, pastdagi `new Date(\`${date}T00:00:00\`)` esa allaqachon
  // mahalliy vaqt sifatida talqin qilinadi - ikkalasi mos kelishi kerak.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Bugungi kunni "ochadi" - shundan keyingina savdo qilish mumkin bo'ladi
 * (`assertDayOpenForSales` shu yozuvni tekshiradi). Bir kunga bitta yozuv -
 * qayta bosilsa (masalan avval yopib qo'yilgan bo'lsa, qayta ochish uchun)
 * `openedAt` yangilanadi (upsert).
 */
export async function openToday(note?: string | null) {
  const date = todayKey();
  const values = { openingDate: date, openedAt: new Date(), note: note ?? null };

  const [existing] = await db.select().from(dayOpenings).where(eq(dayOpenings.openingDate, date));
  if (existing) {
    const [updated] = await db
      .update(dayOpenings)
      .set(values)
      .where(eq(dayOpenings.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(dayOpenings).values(values).returning();
  return created;
}

/**
 * Bugungi kunni "yopadi": 1) hozirgi kassa qoldig'ini buxgalteriyaga
 * o'tkazadi (haqiqiy pul harakati, xuddi qo'lda "Kassadan o'tkazish" kabi -
 * qoldiq 0 bo'lsa o'tkazma yaratilmaydi), 2) kassa qoldig'i/ombordagi qiymat/
 * bugungi savdo/davr kirim-chiqimini "suratga oladi" va saqlaydi, 3) kun
 * "yopiq" holatga o'tadi - qayta ochilmaguncha yangi savdo yaratib bo'lmaydi.
 * Kun avval ochilmagan bo'lsa xato qaytaradi. Bir kunga bitta yozuv - kuni
 * davomida qayta bosilsa, mavjud yozuv yangilanadi (upsert;
 * qoldiq allaqachon 0 bo'lgani uchun qayta o'tkazma bo'lmaydi).
 */
export async function closeToday(note?: string | null) {
  const date = todayKey();

  // Hammasi bitta tranzaksiyada, `dayOpenings` yozuvini `FOR UPDATE` bilan
  // qulflab - shu kunga ikkita "Kunni yopish" so'rovi bir vaqtda kelsa
  // (masalan tugma ikki marta tez bosilsa, yoki ikki tabda), ikkinchisi
  // birinchisi commit bo'lguncha shu yerda kutadi. Shu bilan ikkalasi ham
  // bir xil (hali o'tkazilmagan) qoldiqni o'qib, kassani ikki marta
  // bo'shatib qo'yishining oldi olinadi (CLAUDE.md: pul bilan bog'liq
  // operatsiyalar `.for("update")` bilan himoyalanishi kerak).
  return db.transaction(async (tx) => {
    const [opening] = await tx
      .select()
      .from(dayOpenings)
      .where(eq(dayOpenings.openingDate, date))
      .for("update");
    if (!opening) throw new Error("Kun hali ochilmagan - avval kunni oching");

    const qs = { from: new Date(`${date}T00:00:00`), to: new Date(`${date}T23:59:59.999`) };
    // `currentBalanceUzs` har doim butun tarix bo'yicha (davr filtridan qat'i
    // nazar) - shuning uchun shu yerdan olingan qiymat haqiqiy o'tkaziladigan
    // summa uchun ham to'g'ri. Qulfdan keyin o'qilgani uchun (ikkinchi so'rov
    // birinchisi commit bo'lguncha bloklanadi) - har doim eng so'nggi,
    // haqiqiy qoldiqni ko'radi.
    const [cashSummary, dashboard] = await Promise.all([getCashSummary(qs), getDashboardSummary()]);

    if (cashSummary.currentBalanceUzs > 0) {
      await transferToAccounting(tx, {
        amountUzs: cashSummary.currentBalanceUzs,
        note: `Kunni yopish (${date})`,
      });
    }

    const values = {
      closingDate: date,
      kassaBalanceUzs: String(cashSummary.currentBalanceUzs),
      warehouseStockValueUzs: String(dashboard.stockValueUzs),
      todaySalesUzs: String(dashboard.todaySalesUzs),
      periodInUzs: String(cashSummary.periodInUzs),
      periodOutUzs: String(cashSummary.periodOutUzs),
      note: note ?? null,
      closedAt: new Date(),
    };

    const [existing] = await tx.select().from(dayClosings).where(eq(dayClosings.closingDate, date));
    if (existing) {
      const [updated] = await tx
        .update(dayClosings)
        .set(values)
        .where(eq(dayClosings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx.insert(dayClosings).values(values).returning();
    return created;
  });
}

export async function listDayClosings() {
  return db.query.dayClosings.findMany({ orderBy: (t, { desc }) => desc(t.closingDate) });
}

export async function getLatestDayClosing() {
  const rows = await db.query.dayClosings.findMany({
    orderBy: (t, { desc }) => desc(t.closingDate),
    limit: 1,
  });
  return rows[0] ?? null;
}

/**
 * Bugungi kun savdo uchun ochiqmi - kun ochilgan (dayOpenings bor) VA undan
 * keyin yopilmagan bo'lsa (dayClosings yo'q, yoki yopilgan bo'lsa ham undan
 * keyin qayta ochilgan bo'lsa) "ochiq" hisoblanadi.
 */
export async function getTodayStatus() {
  const date = todayKey();
  const [opening] = await db.select().from(dayOpenings).where(eq(dayOpenings.openingDate, date));
  const [closing] = await db.select().from(dayClosings).where(eq(dayClosings.closingDate, date));

  const opened = !!opening;
  const closed = !!closing && (!opening || closing.closedAt >= opening.openedAt);
  return {
    date,
    opened,
    closed,
    canSell: opened && !closed,
    openedAt: opening?.openedAt ?? null,
    closedAt: closing?.closedAt ?? null,
  };
}

/** `createSale` shu yerdan chaqiradi - kun ochilmagan/yopilgan bo'lsa xato. */
export async function assertDayOpenForSales() {
  const status = await getTodayStatus();
  if (!status.canSell) {
    throw new Error(
      status.opened
        ? "Bugungi kun yopilgan - savdo qilish uchun avval Kassa sahifasidan kunni qayta oching"
        : "Bugungi kun hali ochilmagan - savdo qilish uchun avval Kassa sahifasidan kunni oching"
    );
  }
}
