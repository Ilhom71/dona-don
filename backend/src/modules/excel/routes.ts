import { Hono } from "hono";
import {
  exportProducts,
  exportSales,
  exportPurchases,
  exportStockMovements,
  exportPartnerStatement,
  exportCashLedger,
  exportProductsTemplate,
  exportExpensesTemplate,
} from "./export";
import { importProducts, importExpenses } from "./import";
import { requireAuth } from "../../middleware/auth";

export const excelRoutes = new Hono();
excelRoutes.use("*", requireAuth);

function excelResponse(c: any, buffer: Buffer, filename: string) {
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(buffer);
}

excelRoutes.get("/products/export", async (c) => {
  const buffer = await exportProducts();
  return excelResponse(c, buffer, "mahsulotlar.xlsx");
});

excelRoutes.get("/products/template", async (c) => {
  const buffer = await exportProductsTemplate();
  return excelResponse(c, buffer, "mahsulotlar-shablon.xlsx");
});

excelRoutes.get("/expenses/template", async (c) => {
  const buffer = await exportExpensesTemplate();
  return excelResponse(c, buffer, "xarajatlar-shablon.xlsx");
});

excelRoutes.get("/sales/export", async (c) => {
  const buffer = await exportSales();
  return excelResponse(c, buffer, "savdolar.xlsx");
});

// Savdo tarixida checkbox bilan belgilangan savdolarnigina eksport qilish uchun.
excelRoutes.post("/sales/export", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined;
  const buffer = await exportSales(ids);
  return excelResponse(c, buffer, "savdolar.xlsx");
});

excelRoutes.get("/purchases/export", async (c) => {
  const buffer = await exportPurchases();
  return excelResponse(c, buffer, "xaridlar.xlsx");
});

// Kirim-chiqim tarixida checkbox bilan belgilanganlarni eksport qilish uchun (kelajakda).
excelRoutes.post("/purchases/export", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined;
  const buffer = await exportPurchases(ids);
  return excelResponse(c, buffer, "xaridlar.xlsx");
});

excelRoutes.get("/stock-movements/export", async (c) => {
  const buffer = await exportStockMovements();
  return excelResponse(c, buffer, "kirim-chiqim.xlsx");
});

excelRoutes.get("/cash/export", async (c) => {
  const buffer = await exportCashLedger();
  return excelResponse(c, buffer, "kassa.xlsx");
});

excelRoutes.get("/partners/:id/statement", async (c) => {
  try {
    const buffer = await exportPartnerStatement(c.req.param("id"));
    return excelResponse(c, buffer, "hisob-varaq.xlsx");
  } catch (err) {
    return c.json({ error: (err as Error).message }, 404);
  }
});

excelRoutes.post("/products/import", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "Fayl yuborilmadi" }, 400);
  }
  try {
    const result = await importProducts(await file.arrayBuffer());
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

excelRoutes.post("/expenses/import", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "Fayl yuborilmadi" }, 400);
  }
  try {
    const result = await importExpenses(await file.arrayBuffer());
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
