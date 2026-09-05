import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./modules/auth/routes";
import { requireAuth } from "./middleware/auth";
import { productRoutes } from "./modules/products/routes";
import { warehouseRoutes } from "./modules/warehouses/routes";
import { partnerRoutes } from "./modules/partners/routes";
import { stockRoutes } from "./modules/stock/routes";
import { saleRoutes } from "./modules/sales/routes";
import { paymentRoutes } from "./modules/payments/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { reportRoutes } from "./modules/reports/routes";
import { excelRoutes } from "./modules/excel/routes";

const app = new Hono();

app.use(logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);

app.get("/", (c) => c.json({ name: "donadon-api", status: "ok" }));

app.route("/auth", authRoutes);

// Qolgan barcha modullar o'z ichida requireAuth middleware'ni talab qiladi
// (har bir modul faylining boshida, pastga qarang)
app.route("/products", productRoutes);
app.route("/warehouses", warehouseRoutes);
app.route("/partners", partnerRoutes);
app.route("/stock", stockRoutes);
app.route("/sales", saleRoutes);
app.route("/payments", paymentRoutes);
app.route("/settings", settingsRoutes);
app.route("/reports", reportRoutes);
app.route("/excel", excelRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Serverda kutilmagan xatolik yuz berdi" }, 500);
});

export default {
  port: Number(process.env.PORT ?? 4000),
  fetch: app.fetch,
};
