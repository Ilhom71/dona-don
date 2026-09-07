import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products, partners } from "../../db/schema";
import { createExpense, type ExpenseCategory } from "../expenses/service";

/**
 * Mahsulotlar Excel faylidan import qilinadi. Ustunlar: Nomi, O'lchov birligi (kg/ton).
 * Nomi bo'yicha mos kelsa yangilanadi, aks holda yangi mahsulot yaratiladi.
 * Qoldiq va tannarx import orqali o'zgartirilmaydi - ular faqat kirim/chiqim orqali yangilanadi.
 */
export async function importProducts(fileBuffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Fayl bo'sh yoki noto'g'ri formatda");

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const name = String(row.getCell(1).value ?? "").trim();
    const unitRaw = String(row.getCell(2).value ?? "").trim().toLowerCase();

    if (!name) continue;
    const unit = unitRaw === "ton" || unitRaw === "tonna" ? "ton" : "kg";

    const [existing] = await db.select().from(products).where(eq(products.name, name)).limit(1);
    if (existing) {
      await db.update(products).set({ unit, updatedAt: new Date() }).where(eq(products.id, existing.id));
      updated++;
    } else {
      await db.insert(products).values({ name, unit });
      created++;
    }
  }

  return { created, updated, errors };
}

const CATEGORY_LOOKUP: Record<string, ExpenseCategory> = {
  supplier_payment: "supplier_payment",
  "yetkazib beruvchiga to'lov": "supplier_payment",
  salary: "salary",
  "ish haqi": "salary",
  rent: "rent",
  ijara: "rent",
  transport: "transport",
  utilities: "utilities",
  "kommunal xizmatlar": "utilities",
  other: "other",
  boshqa: "other",
};

const METHOD_LOOKUP: Record<string, "cash" | "card" | "bank"> = {
  cash: "cash",
  naqd: "cash",
  card: "card",
  karta: "card",
  bank: "bank",
  "bank o'tkazmasi": "bank",
};

/**
 * Xarajatlar Excel faylidan bulk import qilinadi (masalan oylik ish haqi
 * ro'yxatini bir martada kiritish uchun). Ustunlar: Sana, Kategoriya,
 * Hamkor nomi (ixtiyoriy), Summa, Valyuta, Usuli, Tavsif. Har bir qator
 * alohida `expenses` yozuvi sifatida qo'shiladi (immutable ledger - import
 * mavjud yozuvlarni o'zgartirmaydi, faqat yangi qo'shadi).
 */
export async function importExpenses(fileBuffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Fayl bo'sh yoki noto'g'ri formatda");

  let created = 0;
  const errors: string[] = [];

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const dateRaw = row.getCell(1).value;
    const categoryRaw = String(row.getCell(2).value ?? "").trim().toLowerCase();
    const partnerName = String(row.getCell(3).value ?? "").trim();
    const amountRaw = row.getCell(4).value;
    const currencyRaw = String(row.getCell(5).value ?? "UZS").trim().toUpperCase();
    const methodRaw = String(row.getCell(6).value ?? "cash").trim().toLowerCase();
    const description = String(row.getCell(7).value ?? "").trim();

    if (!categoryRaw && !amountRaw && !description) continue; // bo'sh qator

    const category = CATEGORY_LOOKUP[categoryRaw];
    const amount = Number(amountRaw);

    if (!category) {
      errors.push(`${i}-qator: kategoriya "${categoryRaw}" tanilmadi`);
      continue;
    }
    if (!amount || amount <= 0) {
      errors.push(`${i}-qator: summa noto'g'ri`);
      continue;
    }
    if (!description) {
      errors.push(`${i}-qator: tavsif kiritilmagan`);
      continue;
    }

    let partnerId: string | null = null;
    if (partnerName) {
      const [partner] = await db.select().from(partners).where(eq(partners.name, partnerName)).limit(1);
      if (partner) partnerId = partner.id;
      else errors.push(`${i}-qator: "${partnerName}" nomli hamkor topilmadi, hamkorsiz saqlandi`);
    }

    await createExpense({
      category,
      partnerId,
      amount,
      currency: currencyRaw === "USD" ? "USD" : "UZS",
      method: METHOD_LOOKUP[methodRaw] ?? "cash",
      description,
      expenseDate: dateRaw instanceof Date ? dateRaw : undefined,
    });
    created++;
  }

  return { created, updated: 0, errors };
}
