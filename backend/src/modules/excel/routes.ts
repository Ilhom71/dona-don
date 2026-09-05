import { Hono } from "hono";
import {
  exportProducts,
  exportSales,
  exportStockMovements,
  exportPartnerStatement,
} from "./export";
import { importProducts } from "./import";
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

excelRoutes.get("/sales/export", async (c) => {
  const buffer = await exportSales();
  return excelResponse(c, buffer, "savdolar.xlsx");
});

excelRoutes.get("/stock-movements/export", async (c) => {
  const buffer = await exportStockMovements();
  return excelResponse(c, buffer, "kirim-chiqim.xlsx");
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
