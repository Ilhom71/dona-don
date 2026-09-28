"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { AccountingReport, ProfitPoint } from "@/lib/types";
import { formatMoney, formatMoneyCompact, toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseBreakdown } from "./expense-breakdown";

type Period = "day" | "week" | "month" | "year" | "custom";

const periodLabels: Record<Period, string> = {
  day: "Bugun",
  week: "Hafta",
  month: "Oy",
  year: "Yil",
  custom: "Oraliq",
};

/** YYYY-MM-DD ga kun qo'shadi (UTC arifmetikasi - vaqt zonasi siljishisiz). */
function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tezkor davr uchun boshlanish sanasi; tugashi - bugun. */
function periodStart(period: Exclude<Period, "custom">, today: string) {
  if (period === "day") return today;
  if (period === "week") return addDays(today, -6);
  if (period === "month") return `${today.slice(0, 7)}-01`;
  return `${today.slice(0, 4)}-01-01`;
}

/**
 * Backend faqat faoliyat bo'lgan kunlarni qaytaradi - bo'sh kunlarni (yoki
 * oylarni) nol bilan to'ldiramiz, shunda grafik uzluksiz ko'rinadi.
 */
function fillPoints(points: ProfitPoint[], from: string, to: string, monthly: boolean) {
  const byKey = new Map(points.map((p) => [p.day, p]));
  const keys: string[] = [];
  if (monthly) {
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const endY = Number(to.slice(0, 4));
    const endM = Number(to.slice(5, 7));
    while (y < endY || (y === endY && m <= endM)) {
      keys.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
  }
  return keys.map((key) => {
    const p = byKey.get(key);
    const sales = p?.salesUzs ?? 0;
    // Xarajat ustuni = tannarx + boshqa xarajatlar (sof foyda = daromad - shu)
    const costs = (p?.cogsUzs ?? 0) + (p?.expensesUzs ?? 0);
    return {
      key,
      label: monthly ? key.slice(2) : `${key.slice(8, 10)}.${key.slice(5, 7)}`,
      sales,
      costs,
      profit: p?.profitUzs ?? sales - costs,
    };
  });
}

/** Foyda-zarar bloki: davr tugmalari, grafik va "zinapoya" hisob. */
export function ProfitSection() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const today = toDateInputValue(new Date());
  const from = period === "custom" ? customFrom : periodStart(period, today);
  const to = period === "custom" ? customTo : today;
  const validRange = !!from && !!to && from <= to;

  // 90 kundan uzun davr oylik ko'rinishga o'tadi (backend ham shunday qiladi)
  const monthly = useMemo(() => {
    if (!validRange) return false;
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    return days > 90;
  }, [from, to, validRange]);

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["accounting-report", from, to],
    enabled: validRange,
    queryFn: () => api.get<AccountingReport>(`/reports/accounting?from=${from}&to=${to}`),
  });

  const { data: points, isLoading: pointsLoading } = useQuery({
    queryKey: ["profit-report", from, to, monthly],
    enabled: validRange,
    queryFn: () =>
      api.get<ProfitPoint[]>(
        `/reports/profit?from=${from}&to=${to}&groupBy=${monthly ? "month" : "day"}`
      ),
  });

  const chartData = useMemo(
    () => (validRange ? fillPoints(points ?? [], from, to, monthly) : []),
    [points, from, to, monthly, validRange]
  );
  const hasActivity = chartData.some((d) => d.sales !== 0 || d.costs !== 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Foyda va zarar
        </CardTitle>
        <CardDescription>Tanlangan davrda savdodan qancha foyda (yoki zarar) qoldi</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-2">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="profit-from" className="text-xs text-muted-foreground">
                Boshlanish
              </Label>
              <Input
                id="profit-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profit-to" className="text-xs text-muted-foreground">
                Tugash
              </Label>
              <Input
                id="profit-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {!validRange ? (
          <p className="text-sm text-muted-foreground">
            Boshlanish va tugash sanasini to&apos;g&apos;ri tanlang
          </p>
        ) : (
          <>
            {/* Ustunli grafik + sof foyda chizig'i */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <LegendDot className="bg-primary" label="Daromad (sotgan pulimiz)" />
                <LegendDot className="bg-destructive" label="Xarajat (tannarx bilan)" />
                <LegendDot className="bg-emerald-500" label="Sof foyda" line />
              </div>
              {pointsLoading ? (
                <Skeleton className="h-56" />
              ) : !hasActivity ? (
                <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                  Bu davrda savdo yoki xarajat bo&apos;lmagan
                </p>
              ) : (
                <div
                  className="h-56 w-full sm:h-72"
                  role="img"
                  aria-label="Daromad, xarajat va sof foyda grafigi"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        width={48}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => axisMoney(v)}
                      />
                      <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<ChartTooltip />} />
                      <Bar dataKey="sales" name="Daromad" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="costs" name="Xarajat" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
                      <Line
                        dataKey="profit"
                        name="Sof foyda"
                        type="monotone"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={chartData.length <= 31}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* "Zinapoya": daromad - tannarx - xarajat = sof foyda */}
            {reportLoading || !report ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-4 border-t pt-4">
                <ProfitSteps report={report} />
                <ExpenseBreakdown categories={report.expensesByCategory} totalUzs={report.expensesUzs} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Y o'qi uchun qisqa son: 1 250 000 -> "1,3mln". */
function axisMoney(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}mlrd`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}mln`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}ming`;
  return String(v);
}

function LegendDot({ className, label, line }: { className: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn(line ? "h-0.5 w-3" : "h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}

type TooltipEntry = { name?: string; value?: number | string };

/** Grafik ustiga bosilganda/hover'da ko'rinadigan izoh (to'liq summalar bilan). */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((e) => (
        <p key={e.name} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{e.name}</span>
          <span className="font-medium tabular-nums">{formatMoney(Number(e.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

/** Oddiy tilda hisob: Daromad - Tannarx - Xarajat = Sof foyda. */
function ProfitSteps({ report }: { report: AccountingReport }) {
  const profit = report.netProfitUzs;
  const tone = profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
  return (
    <div className="space-y-2">
      <StepRow
        sign=""
        label="Daromad"
        note={`Sotgan narsamiz uchun olgan pulimiz (${report.saleCount} ta savdo)`}
        extra={report.freightUzs > 0 ? `shundan yuk puli ${formatMoneyCompact(report.freightUzs)}` : undefined}
        value={report.revenueUzs}
      />
      <StepRow sign="-" label="Tannarx" note="Sotilgan donning o'zimizga tushgan narxi" value={report.cogsUzs} />
      <StepRow
        sign="-"
        label="Xarajatlar"
        note="Ish haqi, ijara, transport va boshqa sarflar"
        value={report.expensesUzs}
      />
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border-2 p-3",
          profit >= 0 ? "border-emerald-500/60 bg-emerald-500/5" : "border-destructive/60 bg-destructive/5"
        )}
      >
        <div className="min-w-0">
          <p className={cn("flex items-center gap-1.5 font-semibold", tone)}>
            {profit > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : profit < 0 ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            {profit >= 0 ? "Sof foyda" : "Sof zarar"}
          </p>
          <p className="text-xs text-muted-foreground">Hamma sarfdan keyin qo&apos;limizda qolgan pul</p>
        </div>
        <p className={cn("shrink-0 text-lg font-bold tabular-nums", tone)} title={formatMoney(profit)}>
          {formatMoneyCompact(profit)}
        </p>
      </div>
    </div>
  );
}

function StepRow({
  sign,
  label,
  note,
  extra,
  value,
}: {
  sign: string;
  label: string;
  note: string;
  extra?: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {sign && <span className="mr-1.5 text-muted-foreground">{sign}</span>}
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          {note}
          {extra && <span className="block">{extra}</span>}
        </p>
      </div>
      <p className="shrink-0 font-semibold tabular-nums" title={formatMoney(value)}>
        {formatMoneyCompact(value)}
      </p>
    </div>
  );
}
