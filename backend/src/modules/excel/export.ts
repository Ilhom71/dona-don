import ExcelJS from "exceljs";
import { asc, isNull } from "drizzle-orm";
import { db } from "../../db";
import { products } from "../../db/schema";
import { listSales } from "../sales/service";
import { listPurchases } from "../purchases/service";
import { getPartner, getPartnerLedger, listPartnersWithBalance } from "../partners/service";
import { getCashLedger } from "../cash/service";
import { formatTashkentDate, formatTashkentDateTime } from "../../utils/date";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8AC2E" }, // don/bug'doy rangiga mos oltin-sariq
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D0D0" } },
  left: { style: "thin", color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
  right: { style: "thin", color: { argb: "FFD0D0D0" } },
};

async function toBuffer(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

/** Sarlavha qatorini va butun jadvalni "Shoxrux aka tegirmon" uslubidagi jadvalga o'xshatib bezaydi. */
function styleSheet(ws: ExcelJS.Worksheet, title: string) {
  const colCount = ws.columns?.length ?? 1;
  ws.insertRow(1, []);
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = HEADER_FILL;
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 2 }];
}

function styleDataRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
    });
  }
}

function addTotalsRow(ws: ExcelJS.Worksheet, values: (string | number | null)[]) {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.border = { top: { style: "double", color: { argb: "FF888888" } } };
  });
  return row;
}

export async function exportProducts() {
  // Arxivlangan (o'chirilgan) mahsulotlar eksportga kirmaydi - boshqa
  // ro'yxatlar bilan bir xil naqsh (faol ro'yxatni aks ettiradi).
  const rows = await db
    .select()
    .from(products)
    .where(isNull(products.archivedAt))
    .orderBy(asc(products.name));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mahsulotlar");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Nomi", key: "name", width: 26 },
    { header: "Birlik", key: "unit", width: 10 },
    { header: "Qoldiq", key: "stockQuantity", width: 14 },
    { header: "Tan narx (so'm)", key: "avgCostUzs", width: 16 },
    { header: "Sotuv narxi (so'm)", key: "sellingPriceUzs", width: 18 },
    { header: "Jami qiymat (so'm)", key: "totalValue", width: 18 },
    { header: "Izoh", key: "notes", width: 26 },
  ];

  let totalQty = 0;
  let totalValue = 0;
  rows.forEach((r, i) => {
    const qty = Number(r.stockQuantity);
    const value = qty * Number(r.avgCostUzs);
    totalQty += qty;
    totalValue += value;
    const row = ws.addRow({
      no: i + 1,
      name: r.name,
      unit: r.unit === "ton" ? "tonna" : "kg",
      stockQuantity: qty,
      avgCostUzs: Number(r.avgCostUzs),
      sellingPriceUzs: r.sellingPriceUzs ? Number(r.sellingPriceUzs) : null,
      totalValue: value,
      notes: r.notes ?? "",
    });
    ["D", "E", "F", "G"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, "Mahsulotlar");
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, ["", "Jami", "", totalQty, "", "", totalValue, ""]);
  totalsRow.getCell(4).numFmt = "#,##0";
  totalsRow.getCell(7).numFmt = "#,##0";
  return toBuffer(wb);
}

const SALE_STATUS_LABELS: Record<string, string> = {
  paid: "To'liq to'langan",
  partial: "Qisman to'langan",
  credit: "Nasiya",
  cancelled: "Bekor qilingan",
};

/** `ids` berilsa, faqat o'sha savdolarni (masalan savdo tarixida belgilanganlarni) chiqaradi. */
export async function exportSales(ids?: string[]) {
  const allRows = await listSales({});
  // Bekor qilingan (arxivdagi) savdolar eksportga kirmaydi - ro'yxat va jamiga ham.
  const activeRows = allRows.filter((r) => !r.cancelledAt && r.paymentStatus !== "cancelled");
  const rows = ids ? activeRows.filter((r) => ids.includes(r.id)) : activeRows;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Savdolar");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "saleDate", width: 14 },
    { header: "Hamkor", key: "partner", width: 24 },
    { header: "Ombor", key: "warehouse", width: 18 },
    { header: "Mashina raqami", key: "vehicleNumber", width: 16 },
    { header: "Valyuta", key: "currency", width: 10 },
    { header: "Summasi", key: "totalAmount", width: 16 },
    { header: "Summasi (so'm)", key: "totalAmountUzs", width: 18 },
    { header: "To'langan (so'm)", key: "paidAmountUzs", width: 18 },
    { header: "Qoldiq (so'm)", key: "debtUzs", width: 16 },
    { header: "Holati", key: "paymentStatus", width: 14 },
  ];

  let totalUzs = 0;
  let totalPaidUzs = 0;
  rows.forEach((r, i) => {
    totalUzs += Number(r.totalAmountUzs);
    totalPaidUzs += Number(r.paidAmountUzs);
    const row = ws.addRow({
      no: i + 1,
      saleDate: formatTashkentDate(r.saleDate),
      partner: r.partner?.name ?? "",
      warehouse: r.warehouse?.name ?? "",
      vehicleNumber: r.vehicleNumber ?? "",
      currency: r.currency,
      totalAmount: Number(r.totalAmount),
      totalAmountUzs: Number(r.totalAmountUzs),
      paidAmountUzs: Number(r.paidAmountUzs),
      debtUzs: Number(r.totalAmountUzs) - Number(r.paidAmountUzs),
      paymentStatus: SALE_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus,
    });
    ["G", "H", "I", "J"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, "Savdolar");
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, [
    "",
    "Jami",
    "",
    "",
    "",
    "",
    "",
    totalUzs,
    totalPaidUzs,
    totalUzs - totalPaidUzs,
    "",
  ]);
  totalsRow.getCell(8).numFmt = "#,##0";
  totalsRow.getCell(9).numFmt = "#,##0";
  totalsRow.getCell(10).numFmt = "#,##0";
  return toBuffer(wb);
}

/** `ids` berilsa, faqat o'sha xaridlarni chiqaradi. */
export async function exportPurchases(ids?: string[]) {
  const allRows = await listPurchases({});
  // Bekor qilingan xaridlar eksportga kirmaydi.
  const activeRows = allRows.filter((r) => !r.cancelledAt && r.paymentStatus !== "cancelled");
  const rows = ids ? activeRows.filter((r) => ids.includes(r.id)) : activeRows;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Xaridlar");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "purchaseDate", width: 14 },
    { header: "Hamkor", key: "partner", width: 24 },
    { header: "Ombor", key: "warehouse", width: 18 },
    { header: "Mashina raqami", key: "vehicleNumber", width: 16 },
    { header: "Valyuta", key: "currency", width: 10 },
    { header: "Summasi", key: "totalAmount", width: 16 },
    { header: "Summasi (so'm)", key: "totalAmountUzs", width: 18 },
    { header: "To'langan (so'm)", key: "paidAmountUzs", width: 18 },
    { header: "Qoldiq (so'm)", key: "debtUzs", width: 16 },
    { header: "Holati", key: "paymentStatus", width: 14 },
  ];

  let totalUzs = 0;
  let totalPaidUzs = 0;
  rows.forEach((r, i) => {
    totalUzs += Number(r.totalAmountUzs);
    totalPaidUzs += Number(r.paidAmountUzs);
    const row = ws.addRow({
      no: i + 1,
      purchaseDate: formatTashkentDate(r.purchaseDate),
      partner: r.partner?.name ?? "",
      warehouse: r.warehouse?.name ?? "",
      vehicleNumber: r.vehicleNumber ?? "",
      currency: r.currency,
      totalAmount: Number(r.totalAmount),
      totalAmountUzs: Number(r.totalAmountUzs),
      paidAmountUzs: Number(r.paidAmountUzs),
      debtUzs: Number(r.totalAmountUzs) - Number(r.paidAmountUzs),
      paymentStatus: SALE_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus,
    });
    ["G", "H", "I", "J"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, "Xaridlar");
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, [
    "",
    "Jami",
    "",
    "",
    "",
    "",
    "",
    totalUzs,
    totalPaidUzs,
    totalUzs - totalPaidUzs,
    "",
  ]);
  totalsRow.getCell(8).numFmt = "#,##0";
  totalsRow.getCell(9).numFmt = "#,##0";
  totalsRow.getCell(10).numFmt = "#,##0";
  return toBuffer(wb);
}

export async function exportStockMovements() {
  // Bekor qilingan (arxivdagi) yozuvlar eksportga kirmaydi.
  const rows = await db.query.stockMovements.findMany({
    where: (t, { isNull }) => isNull(t.cancelledAt),
    with: { product: true, partner: true, warehouse: true },
    orderBy: (t, { desc }) => desc(t.movementDate),
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kirim-chiqim");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "movementDate", width: 14 },
    { header: "Turi", key: "type", width: 10 },
    { header: "Mahsulot nomi", key: "productName", width: 22 },
    { header: "Ombor", key: "warehouseName", width: 18 },
    { header: "Mashina raqami", key: "vehicleNumber", width: 16 },
    { header: "Hamkor", key: "partnerName", width: 22 },
    { header: "Miqdor", key: "quantity", width: 12 },
    { header: "Narx (birlik)", key: "pricePerUnit", width: 14 },
    { header: "Valyuta", key: "currency", width: 10 },
    { header: "Umumiy", key: "total", width: 16 },
    { header: "Izoh", key: "note", width: 26 },
  ];

  let totalQty = 0;
  let totalSum = 0;
  rows.forEach((r, i) => {
    const qty = Number(r.quantity);
    const total = r.pricePerUnit ? qty * Number(r.pricePerUnit) : 0;
    totalQty += qty;
    totalSum += total;
    const row = ws.addRow({
      no: i + 1,
      movementDate: formatTashkentDate(r.movementDate),
      type: r.type === "in" ? "Kirim" : "Chiqim",
      productName: r.product?.name ?? "",
      warehouseName: r.warehouse?.name ?? "",
      vehicleNumber: r.vehicleNumber ?? "",
      partnerName: r.partner?.name ?? "",
      quantity: qty,
      pricePerUnit: r.pricePerUnit ? Number(r.pricePerUnit) : null,
      currency: r.currency,
      total: total || null,
      note: r.note ?? "",
    });
    row.getCell("H").numFmt = "#,##0";
    row.getCell("I").numFmt = "#,##0";
    row.getCell("K").numFmt = "#,##0";
  });

  styleSheet(ws, "Kirim-chiqim");
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, [
    "",
    "Jami",
    "",
    "",
    "",
    "",
    "",
    totalQty,
    "",
    "",
    totalSum,
    "",
  ]);
  totalsRow.getCell(8).numFmt = "#,##0";
  totalsRow.getCell(11).numFmt = "#,##0";
  return toBuffer(wb);
}

const LEDGER_KIND_LABELS: Record<string, string> = {
  delivery: "Savdo",
  payment: "To'lov",
  "purchase-delivery": "Xarid",
  "supplier-payment": "Yetkazib beruvchiga to'lov",
};

/**
 * Bitta hamkor bo'yicha "hisob-varaq": savdo/xarid va to'lovlar xronologik
 * tartibda, har bir qatordan keyingi yugurib boruvchi qoldiq (QOLDIQ +/-)
 * bilan — "Shoxrux aka tegirmon" jadvaliga o'xshash.
 *
 * Muhim: `getPartnerLedger()` - ekrandagi hamkor hisob-varag'i sahifasi
 * (/savdo/hamkorlar/[id]) bilan **bir xil manba**. Ilgari bu funksiya o'zi
 * alohida (eskirgan, faqat `stockMovements`+`sales`+`payments`dan) hisoblardi -
 * natijada bekor qilingan xaridlar ham qarz sifatida chiqib turardi va
 * xarid/qo'lda kassa yozuvlari umuman hisobga kirmasdi, ekrandagi bilan
 * mos kelmasdi.
 */
export async function exportPartnerStatement(partnerId: string) {
  const partner = await getPartner(partnerId);
  if (!partner) throw new Error("Hamkor topilmadi");

  const ledger = await getPartnerLedger(partnerId);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hisob-varaq");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "date", width: 14 },
    { header: "Turi", key: "type", width: 22 },
    { header: "Tavsif", key: "description", width: 30 },
    { header: "Mashina raqami", key: "vehicleNumber", width: 16 },
    { header: "Debet (so'm)", key: "debit", width: 16 },
    { header: "Kredit (so'm)", key: "credit", width: 16 },
    { header: "Qoldiq (so'm)", key: "balance", width: 16 },
    { header: "Holati", key: "status", width: 16 },
  ];

  ledger.forEach((r, i) => {
    const isDebit = r.kind === "delivery" || r.kind === "purchase-delivery";
    const amount = isDebit ? (r.goodsValueUzs ?? 0) + (r.freightCostUzs ?? 0) : (r.paidUzs ?? 0);
    // Kredit qatorlarda (to'lov/yetkazib beruvchiga to'lov) tavsif -
    // debit qatorlarda esa mahsulot nomi + miqdor.
    const description = isDebit
      ? `${r.productName ?? ""} - ${r.quantity ?? ""} ${r.unit ?? ""}`
      : `${LEDGER_KIND_LABELS[r.kind]} (${r.paymentMethod ?? "cash"})`;
    const row = ws.addRow({
      no: i + 1,
      date: formatTashkentDate(new Date(r.date)),
      type: LEDGER_KIND_LABELS[r.kind] ?? r.kind,
      description,
      vehicleNumber: r.vehicleNumber ?? "",
      debit: isDebit ? amount : null,
      credit: isDebit ? null : amount,
      balance: r.balanceUzs,
      status: r.cancelled ? "Bekor qilingan" : "",
    });
    ["F", "G", "H"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, `${partner.name} - hisob-varaq`);
  styleDataRows(ws, 3, ws.rowCount);
  const finalBalance = ledger.at(-1)?.balanceUzs ?? 0;
  const totalsRow = addTotalsRow(ws, ["", "Yakuniy qoldiq", "", "", "", "", "", finalBalance, ""]);
  totalsRow.getCell(8).numFmt = "#,##0";
  return toBuffer(wb);
}

const CASH_DIRECTION_LABELS: Record<string, string> = { in: "Kirim", out: "Chiqim" };
const CASH_METHOD_LABELS: Record<string, string> = { cash: "Naqd", card: "Karta", bank: "Bank o'tkazmasi" };
const CASH_CATEGORY_LABELS: Record<string, string> = {
  sale_payment: "Mijozdan to'lov",
  supplier_payment: "Yetkazib beruvchiga to'lov",
  salary: "Ish haqi",
  rent: "Ijara",
  transport: "Transport",
  utilities: "Kommunal xizmatlar",
  other: "Boshqa",
  manual: "Qo'lda kiritilgan",
  funding: "Pul olib turish",
};

/** Kassaning to'liq harakati (mijozdan to'lov + xarajatlar + qo'lda yozuvlar), yuguruvchi qoldiq bilan. */
export async function exportCashLedger() {
  // Bekor qilingan (arxivdagi) yozuvlar eksportga umuman kirmaydi. Qoldiq
  // ustuni getCashLedger'dan tayyor keladi (bekor qilinganlar unga qo'shilmagan).
  const rows = (await getCashLedger()).filter((r) => !r.cancelled);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kassa");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "date", width: 16 },
    { header: "Yo'nalish", key: "direction", width: 10 },
    { header: "Kategoriya", key: "category", width: 18 },
    { header: "Hamkor", key: "partner", width: 22 },
    { header: "Usuli", key: "method", width: 12 },
    { header: "Tavsif", key: "description", width: 30 },
    { header: "Kirim (so'm)", key: "inUzs", width: 16 },
    { header: "Chiqim (so'm)", key: "outUzs", width: 16 },
    { header: "Qoldiq (so'm)", key: "balanceUzs", width: 16 },
  ];

  let totalIn = 0;
  let totalOut = 0;
  rows.forEach((r, i) => {
    if (r.direction === "in") totalIn += r.amountUzs;
    else totalOut += r.amountUzs;
    const row = ws.addRow({
      no: i + 1,
      date: formatTashkentDateTime(new Date(r.date)),
      // Xarajat (supplier_payment'dan tashqari) - qaytmas chiqim; "Pul olib
      // turish" (funding) - alohida yorliq, UI'dagi kabi bir xil bo'lishi uchun.
      direction:
        r.source === "expense" && r.category !== "supplier_payment"
          ? "Qaytmas chiqim"
          : r.purpose === "funding"
            ? r.direction === "in"
              ? "Pul olib turish"
              : "Pulni qaytarish"
            : (CASH_DIRECTION_LABELS[r.direction] ?? r.direction),
      category: CASH_CATEGORY_LABELS[r.category] ?? r.category,
      partner: r.partnerName ?? "",
      method: CASH_METHOD_LABELS[r.method] ?? r.method,
      description: r.description,
      inUzs: r.direction === "in" ? r.amountUzs : null,
      outUzs: r.direction === "out" ? r.amountUzs : null,
      balanceUzs: r.balanceUzs,
    });
    ["H", "I", "J"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, "Kassa");
  styleDataRows(ws, 3, ws.rowCount);
  // Jami qator: kirim va chiqim ustunlari alohida yig'iladi, oxirgi qoldiq - hozirgi qoldiq.
  const totalsRow2 = addTotalsRow(ws, [
    "",
    "Jami",
    "",
    "",
    "",
    "",
    "",
    totalIn,
    totalOut,
    rows.at(-1)?.balanceUzs ?? 0,
  ]);
  [8, 9, 10].forEach((c) => (totalsRow2.getCell(c).numFmt = "#,##0"));
  return toBuffer(wb);
}

/**
 * Mahsulotlar import qilish uchun bo'sh shablon - ustunlar aynan
 * `importProducts` kutgan tartibda, bitta namuna qator bilan.
 */
export async function exportProductsTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mahsulotlar");
  ws.columns = [
    { header: "Nomi", key: "name", width: 26 },
    { header: "O'lchov birligi (kg/ton)", key: "unit", width: 22 },
  ];
  ws.addRow({ name: "Bug'doy", unit: "kg" });
  styleSheet(ws, "Mahsulotlar - import shabloni");
  styleDataRows(ws, 3, ws.rowCount);
  return toBuffer(wb);
}

/**
 * Xarajatlar import qilish uchun bo'sh shablon - ustunlar aynan
 * `importExpenses` kutgan tartibda, bitta namuna qator bilan.
 */
export async function exportExpensesTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Xarajatlar");
  ws.columns = [
    { header: "Sana", key: "date", width: 14 },
    { header: "Kategoriya", key: "category", width: 24 },
    { header: "Hamkor nomi", key: "partner", width: 22 },
    { header: "Summa", key: "amount", width: 14 },
    { header: "Valyuta", key: "currency", width: 10 },
    { header: "Usuli", key: "method", width: 12 },
    { header: "Tavsif", key: "description", width: 30 },
  ];
  ws.addRow({
    date: formatTashkentDate(new Date()),
    category: "Ish haqi",
    partner: "",
    amount: 500000,
    currency: "UZS",
    method: "Naqd",
    description: "Sentabr oyi uchun ish haqi",
  });
  styleSheet(ws, "Xarajatlar - import shabloni");
  styleDataRows(ws, 3, ws.rowCount);
  return toBuffer(wb);
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  customer: "Mijoz",
  supplier: "Yetkazib beruvchi",
  both: "Mijoz va yetkazib beruvchi",
};

/**
 * Hamkorlar (mijozlar/yetkazib beruvchilar) ro'yxati balanslari bilan.
 * Arxivlangan hamkorlar kirmaydi (listPartnersWithBalance ularni chiqarmaydi). Balans: musbat - hamkor bizga qarzdor
 * ("Menda qarzdorlar"), manfiy - biz hamkorga qarzdormiz ("Qarzlarim").
 */
export async function exportPartners() {
  const rows = await listPartnersWithBalance();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hamkorlar");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Ismi / nomi", key: "name", width: 28 },
    { header: "Turi", key: "type", width: 24 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Manzil", key: "address", width: 26 },
    { header: "Bank hisob raqami", key: "bankAccount", width: 24 },
    { header: "Menda qarzdor (so'm)", key: "owedToMe", width: 20 },
    { header: "Men qarzdorman (so'm)", key: "iOwe", width: 22 },
    { header: "Balans (so'm)", key: "balance", width: 18 },
  ];

  let totalOwedToMe = 0;
  let totalIOwe = 0;
  let totalBalance = 0;
  rows.forEach((p, i) => {
    const owedToMe = Math.max(0, p.balanceUzs);
    const iOwe = Math.max(0, -p.balanceUzs);
    totalOwedToMe += owedToMe;
    totalIOwe += iOwe;
    totalBalance += p.balanceUzs;
    const row = ws.addRow({
      no: i + 1,
      name: p.name,
      type: PARTNER_TYPE_LABELS[p.type] ?? p.type,
      phone: p.phone ?? "",
      address: p.address ?? "",
      bankAccount: p.bankAccount ?? "",
      owedToMe: owedToMe || null,
      iOwe: iOwe || null,
      balance: p.balanceUzs,
    });
    ["G", "H", "I"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, "Hamkorlar");
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, ["", "Jami", "", "", "", "", totalOwedToMe, totalIOwe, totalBalance]);
  [7, 8, 9].forEach((c) => (totalsRow.getCell(c).numFmt = "#,##0"));
  return toBuffer(wb);
}

/**
 * Kassa import shabloni - ustunlar aynan `exportCashLedger` chiqargan va
 * `importCashLedger` kutgan tartibda (eksport qilingan fayl qayta yuklanadi).
 */
export async function exportCashTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kassa");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "date", width: 16 },
    { header: "Yo'nalish", key: "direction", width: 16 },
    { header: "Kategoriya", key: "category", width: 18 },
    { header: "Hamkor", key: "partner", width: 22 },
    { header: "Usuli", key: "method", width: 12 },
    { header: "Tavsif", key: "description", width: 30 },
    { header: "Kirim (so'm)", key: "inUzs", width: 16 },
    { header: "Chiqim (so'm)", key: "outUzs", width: 16 },
    { header: "Qoldiq (so'm)", key: "balanceUzs", width: 16 },
  ];
  // Sample rows: direction must be Kirim / Chiqim / Qaytmas chiqim / Pul olib
  // turish / Pulni qaytarish. "Pul olib turish" va "Pulni qaytarish" satrlarida
  // Hamkor ustuni har doim bo'sh bo'lishi kerak (hamkorga bog'lanmaydi).
  ws.addRow({
    no: 1,
    date: formatTashkentDateTime(new Date()),
    direction: "Kirim",
    category: "Qo'lda kiritilgan",
    partner: "",
    method: "Naqd",
    description: "Namuna: kassaga pul qo'shildi",
    inUzs: 1000000,
    outUzs: null,
    balanceUzs: null,
  });
  ws.addRow({
    no: 2,
    date: formatTashkentDateTime(new Date()),
    direction: "Qaytmas chiqim",
    category: "Boshqa",
    partner: "",
    method: "Naqd",
    description: "Namuna: benzin",
    inUzs: null,
    outUzs: 130000,
    balanceUzs: null,
  });
  ws.addRow({
    no: 3,
    date: formatTashkentDateTime(new Date()),
    direction: "Pul olib turish",
    category: "Pul olib turish",
    partner: "",
    method: "Naqd",
    description: "Namuna: kassani to'ldirish uchun pul kiritildi",
    inUzs: 500000,
    outUzs: null,
    balanceUzs: null,
  });
  styleSheet(ws, "Kassa - import shabloni");
  styleDataRows(ws, 3, ws.rowCount);
  return toBuffer(wb);
}
