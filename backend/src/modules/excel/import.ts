import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products, partners, cashTransactions, expenses } from "../../db/schema";
import { createExpense, type ExpenseCategory } from "../expenses/service";
import { createCashTransaction } from "../cash/service";
import { parseDateParam } from "../../utils/date";

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
      else if (category !== "supplier_payment")
        errors.push(`${i}-qator: "${partnerName}" nomli hamkor topilmadi, hamkorsiz saqlandi`);
    }
    // Hamkorsiz yetkazib beruvchiga to'lov hech kimning qarzini kamaytirmaydi - o'tkazib yuboriladi.
    if (category === "supplier_payment" && !partnerId) {
      errors.push(`${i}-qator: yetkazib beruvchiga to'lov uchun hamkor topilmadi`);
      continue;
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

/**
 * Converts an Excel date cell into a Date, reading the clock as Asia/Tashkent
 * time. Accepts the export format "YYYY-MM-DD HH:mm" (or date only), or a real
 * Excel date cell (whose clock is read from its UTC fields, as exceljs
 * returns serial dates as UTC).
 */
function parseCashDateCell(value: ExcelJS.CellValue): Date | undefined {
  if (value instanceof Date) {
    return parseDateParam(value.toISOString().slice(0, 16));
  }
  const text = String(value ?? "").trim().replace(" ", "T");
  return parseDateParam(text);
}

/**
 * Kassa Excel importi - aynan `exportCashLedger` formatini qabul qiladi:
 * 1-qator sarlavha (nom), 2-qator ustun nomlari, 3-qatordan ma'lumotlar,
 * oxirgi "Jami" qatori o'tkazib yuboriladi.
 * Ustunlar: №, Sana, Yo'nalish, Kategoriya, Hamkor, Usuli, Tavsif, Kirim,
 * Chiqim, Qoldiq (qoldiq e'tiborga olinmaydi - u har doim qayta hisoblanadi).
 * - "Kirim" / "Chiqim" -> cash_transactions (qo'lda kassa yozuvi)
 * - "Qaytmas chiqim"   -> expenses (category "other")
 * Hamkor nomi bo'yicha topiladi; topilmasa qator o'tkazib yuboriladi va
 * errors'ga yoziladi (hamkor avtomatik yaratilmaydi). Yaroqli qatorlarning
 * hammasi bitta tranzaksiyada yoziladi.
 */
export async function importCashLedger(fileBuffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Fayl bo'sh yoki noto'g'ri formatda");

  const errors: string[] = [];

  type ParsedRow = {
    kind: "in" | "out" | "non_returnable";
    date: Date;
    partnerId: string | null;
    method: "cash" | "card" | "bank";
    description: string;
    amount: number;
    // true = "Pul olib turish" / "Pulni qaytarish" (kassani to'ldirish uchun kiritilgan pul)
    funding: boolean;
  };
  const parsedRows: ParsedRow[] = [];
  let skipped = 0;

  // Rows already in the database (same direction/amount/date/partner/note) are
  // skipped, so re-uploading an exported file does not double-count anything.
  const existingCash = await db.select().from(cashTransactions);
  const existingExpenses = await db.select().from(expenses);
  const rowKey = (
    kind: string,
    amount: number,
    date: Date,
    partnerId: string | null,
    note: string,
    funding = false
  ) => [kind, amount, date.getTime(), partnerId ?? "", note.trim(), funding].join("|");
  const seen = new Set<string>();
  for (const c of existingCash) {
    seen.add(
      rowKey(c.direction, Number(c.amountUzs), c.transactionDate, c.partnerId, c.note, c.purpose === "funding")
    );
  }
  for (const e of existingExpenses) {
    seen.add(rowKey("non_returnable", Number(e.amountUzs), e.expenseDate, e.partnerId, e.description));
  }

  // Partner names are looked up case-insensitively; loaded once.
  const allPartners = await db.select({ id: partners.id, name: partners.name }).from(partners);
  const partnerByName = new Map(allPartners.map((p) => [p.name.trim().toLowerCase(), p.id]));

  for (let i = 3; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const dateCell = row.getCell(2).value;
    const directionRaw = String(row.getCell(3).value ?? "").trim().toLowerCase();
    const partnerName = String(row.getCell(5).value ?? "").trim();
    const methodRaw = String(row.getCell(6).value ?? "").trim().toLowerCase();
    const description = String(row.getCell(7).value ?? "").trim();
    const inAmount = Number(row.getCell(8).value ?? 0) || 0;
    const outAmount = Number(row.getCell(9).value ?? 0) || 0;

    // Skip the trailing "Jami" (totals) row and fully empty rows.
    if (String(dateCell ?? "").trim().toLowerCase() === "jami") continue;
    if (!dateCell && !directionRaw && !description && !inAmount && !outAmount) continue;

    // "Mijozdan to'lov" and "Yetkazib beruvchiga to'lov" rows are generated from
    // payments/expenses of sales and purchases; importing them would count them twice.
    const categoryRaw = String(row.getCell(4).value ?? "").trim().toLowerCase();
    if (categoryRaw === "mijozdan to'lov" || categoryRaw === "yetkazib beruvchiga to'lov") {
      skipped++;
      continue;
    }

    let kind: ParsedRow["kind"];
    // "Pul olib turish" / "Pulni qaytarish" - kassani to'ldirish uchun kiritilgan
    // pul (funding), hamkorga bog'lanmaydi va odatiy Kirim/Chiqim'dan ajratiladi.
    let funding = false;
    if (directionRaw === "kirim") kind = "in";
    else if (directionRaw === "chiqim") kind = "out";
    else if (directionRaw === "qaytmas chiqim") kind = "non_returnable";
    else if (directionRaw === "pul olib turish") {
      kind = "in";
      funding = true;
    } else if (directionRaw === "pulni qaytarish") {
      kind = "out";
      funding = true;
    } else {
      errors.push(
        `${i}-qator: yo'nalish "${directionRaw}" tanilmadi (Kirim / Chiqim / Qaytmas chiqim / Pul olib turish / Pulni qaytarish bo'lishi kerak)`
      );
      continue;
    }

    const amount = kind === "in" ? inAmount : outAmount;
    if (!amount || amount <= 0) {
      errors.push(`${i}-qator: summa noto'g'ri`);
      continue;
    }

    const date = parseCashDateCell(dateCell);
    if (!date) {
      errors.push(`${i}-qator: sana noto'g'ri (kutilgan format: YYYY-MM-DD HH:mm)`);
      continue;
    }

    // "Pul olib turish" hech qachon hamkorga bog'lanmaydi.
    if (funding && partnerName) {
      errors.push(`${i}-qator: "Pul olib turish" hamkorga bog'lanmaydi, hamkor ustuni bo'sh bo'lishi kerak`);
      continue;
    }

    let partnerId: string | null = null;
    if (partnerName) {
      partnerId = partnerByName.get(partnerName.toLowerCase()) ?? null;
      if (!partnerId) {
        errors.push(`${i}-qator: "${partnerName}" nomli hamkor topilmadi`);
        continue;
      }
    }

    const finalDescription =
      description || (funding ? (kind === "in" ? "Pul olib turish" : "Pulni qaytarish") : kind === "in" ? "Kirim" : "Chiqim");
    const key = rowKey(kind, amount, date, partnerId, finalDescription, funding);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key); // also protects against duplicate rows inside the same file

    parsedRows.push({
      kind,
      date,
      partnerId,
      method: METHOD_LOOKUP[methodRaw] ?? "cash",
      description: finalDescription,
      amount,
      funding,
    });
  }

  // All valid rows are written atomically: either every row is saved or none.
  let created = 0;
  await db.transaction(async (tx) => {
    for (const r of parsedRows) {
      if (r.kind === "non_returnable") {
        await createExpense(
          {
            category: "other",
            partnerId: r.partnerId,
            amount: r.amount,
            currency: "UZS",
            method: r.method,
            description: r.description,
            expenseDate: r.date,
          },
          tx
        );
      } else {
        await createCashTransaction(
          {
            direction: r.kind,
            amountUzs: r.amount,
            note: r.description,
            partnerId: r.partnerId,
            method: r.method,
            purpose: r.funding ? "funding" : "regular",
            transactionDate: r.date,
          },
          tx
        );
      }
      created++;
    }
  });

  if (skipped > 0) {
    errors.push(
      `${skipped} ta yozuv o'tkazib yuborildi (bazada allaqachon bor yoki savdo/xarid to'lovidan avtomatik hosil bo'lgan)`
    );
  }
  return { created, updated: 0, errors };
}
