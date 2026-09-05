import { Hono } from "hono";
import { getDashboardSummary, getProfitReport } from "./service";
import { requireAuth } from "../../middleware/auth";

export const reportRoutes = new Hono();
reportRoutes.use("*", requireAuth);

reportRoutes.get("/dashboard", async (c) => {
  return c.json(await getDashboardSummary());
});

reportRoutes.get("/profit", async (c) => {
  const { from, to } = c.req.query();
  const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
  const toDate = to ? new Date(to) : new Date();
  return c.json(await getProfitReport(fromDate, toDate));
});
