import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products } from "../../db/schema";

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
