import { Hono } from "hono";
import { getDashboardSummary, getProfitReport, getAccountingReport } from "./service";
import { requireAuth } from "../../middleware/auth";
import { parseDateParam, startOfTashkentMonth } from "../../utils/date";

export const reportRoutes = new Hono();
reportRoutes.use("*", requireAuth);

// Default period: from the start of the current Tashkent month until now.
function resolvePeriod(from?: string, to?: string) {
  return {
    fromDate: parseDateParam(from) ?? startOfTashkentMonth(),
    toDate: parseDateParam(to, { endOfDay: true }) ?? new Date(),
  };
}

reportRoutes.get("/dashboard", async (c) => {
  return c.json(await getDashboardSummary());
});

// Daily (or monthly) profit series. `groupBy=day|month`; when omitted, periods
// longer than 90 days are grouped by month automatically.
reportRoutes.get("/profit", async (c) => {
  const { from, to, groupBy } = c.req.query();
  const { fromDate, toDate } = resolvePeriod(from, to);
  const spanDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  const group = groupBy === "day" || groupBy === "month" ? groupBy : spanDays > 90 ? "month" : "day";
  return c.json(await getProfitReport(fromDate, toDate, group));
});

// Buxgalteriya hisoboti (daromad, tannarx, foyda-zarar, xarajatlar, naqd pul
// oqimi, oldingi davr bilan solishtirish).
reportRoutes.get("/accounting", async (c) => {
  const { from, to } = c.req.query();
  const { fromDate, toDate } = resolvePeriod(from, to);
  return c.json(await getAccountingReport(fromDate, toDate));
});
