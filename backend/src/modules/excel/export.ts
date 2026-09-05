import ExcelJS from "exceljs";
import { eq, asc } from "drizzle-orm";
import { db } from "../../db";
import { products, stockMovements, payments, sales } from "../../db/schema";
import { listSales } from "../sales/service";
import { getPartner } from "../partners/service";

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
  const rows = await db.select().from(products).orderBy(asc(products.name));
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

export async function exportSales() {
  const rows = await listSales({});
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

  const statusLabels: Record<string, string> = {
    paid: "To'liq to'langan",
    partial: "Qisman to'langan",
    credit: "Nasiya",
  };

  let totalUzs = 0;
  let totalPaidUzs = 0;
  rows.forEach((r, i) => {
    totalUzs += Number(r.totalAmountUzs);
    totalPaidUzs += Number(r.paidAmountUzs);
    const row = ws.addRow({
      no: i + 1,
      saleDate: r.saleDate.toISOString().slice(0, 10),
      partner: r.partner?.name ?? "",
      warehouse: r.warehouse?.name ?? "",
      vehicleNumber: r.vehicleNumber ?? "",
      currency: r.currency,
      totalAmount: Number(r.totalAmount),
      totalAmountUzs: Number(r.totalAmountUzs),
      paidAmountUzs: Number(r.paidAmountUzs),
      debtUzs: Number(r.totalAmountUzs) - Number(r.paidAmountUzs),
      paymentStatus: statusLabels[r.paymentStatus] ?? r.paymentStatus,
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

export async function exportStockMovements() {
  const rows = await db.query.stockMovements.findMany({
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
      movementDate: r.movementDate.toISOString().slice(0, 10),
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

/**
 * Bitta hamkor bo'yicha "hisob-varaq": kirim/savdo va to'lovlar xronologik
 * tartibda, har bir qatordan keyingi yugurib boruvchi qoldiq (QOLDIQ +/-)
 * bilan — "Shoxrux aka tegirmon" jadvaliga o'xshash.
 */
export async function exportPartnerStatement(partnerId: string) {
  const partner = await getPartner(partnerId);
  if (!partner) throw new Error("Hamkor topilmadi");

  const movements = await db.query.stockMovements.findMany({
    where: eq(stockMovements.partnerId, partnerId),
    with: { product: true },
  });
  const partnerSales = await db.select().from(sales).where(eq(sales.partnerId, partnerId));
  const partnerPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.partnerId, partnerId));

  type Entry = {
    date: Date;
    type: string;
    description: string;
    debit: number; // hamkor qarzi ortadi (kirim - biz to'lashimiz kerak, yoki savdo - u to'lashi kerak)
    credit: number; // to'lov - qarz kamayadi
  };

  const entries: Entry[] = [];

  for (const m of movements) {
    if (m.type === "in" && m.pricePerUnit) {
      entries.push({
        date: m.movementDate,
        type: "Kirim",
        description: `${m.product?.name ?? ""} - ${Number(m.quantity)} ${m.product?.unit ?? ""}`,
        debit: Number(m.quantity) * Number(m.pricePerUnit),
        credit: 0,
      });
    }
  }
  for (const s of partnerSales) {
    entries.push({
      date: s.saleDate,
      type: "Savdo",
      description: `Savdo (${s.vehicleNumber ?? "-"})`,
      debit: Number(s.totalAmountUzs),
      credit: 0,
    });
  }
  for (const p of partnerPayments) {
    entries.push({
      date: p.paymentDate,
      type: "To'lov",
      description: `To'lov (${p.method})`,
      debit: 0,
      credit: Number(p.amountUzs),
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hisob-varaq");
  ws.columns = [
    { header: "№", key: "no", width: 5 },
    { header: "Sana", key: "date", width: 14 },
    { header: "Turi", key: "type", width: 12 },
    { header: "Tavsif", key: "description", width: 30 },
    { header: "Debet (so'm)", key: "debit", width: 16 },
    { header: "Kredit (so'm)", key: "credit", width: 16 },
    { header: "Qoldiq (so'm)", key: "balance", width: 16 },
  ];

  let balance = 0;
  entries.forEach((e, i) => {
    balance += e.debit - e.credit;
    const row = ws.addRow({
      no: i + 1,
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      description: e.description,
      debit: e.debit || null,
      credit: e.credit || null,
      balance,
    });
    ["E", "F", "G"].forEach((col) => (row.getCell(col).numFmt = "#,##0"));
  });

  styleSheet(ws, `${partner.name} - hisob-varaq`);
  styleDataRows(ws, 3, ws.rowCount);
  const totalsRow = addTotalsRow(ws, [
    "",
    "Yakuniy qoldiq",
    "",
    "",
    "",
    "",
    balance,
  ]);
  totalsRow.getCell(7).numFmt = "#,##0";
  return toBuffer(wb);
}
