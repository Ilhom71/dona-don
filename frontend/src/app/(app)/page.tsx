"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CalendarCheck,
  DollarSign,
  HandCoins,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  AccountingReport,
  CashLedgerRow,
  CashSummary,
  DashboardSummary,
  DayClosing,
  DayStatus,
  Partner,
} from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { KassaSubNav } from "@/components/kassa-subnav";
import { HorizontalBars } from "@/components/kassa-charts";
import {
  expenseCategoryLabels,
  formatDateTime,
  formatMoney,
  formatQuantity,
  toDateInputValue,
} from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";

type RateHistoryItem = { id: string; rate: string; createdAt: string };
type Period = "day" | "month" | "year" | "custom";

const periodLabels: Record<Period, string> = {
  day: "Kunlik",
  month: "Oylik",
  year: "Yillik",
  custom: "Oraliq",
};

/** Tanlangan tezkor davr uchun boshlanish sanasi (YYYY-MM-DD), tugashi - bugun. */
function periodStart(period: Exclude<Period, "custom">) {
  const now = new Date();
  if (period === "day") return toDateInputValue(now);
  if (period === "month") return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  return toDateInputValue(new Date(now.getFullYear(), 0, 1));
}

/**
 * Kassa - ilovaning bosh sahifasi. Buxgalteriya bo'limi olib tashlangan,
 * shuning uchun hamma narsa shu yerda: naqd pul, ombordagi yuk, kun
 * holati, foyda-zarar diagrammasi, qarzdorlar va haqdorlar diagrammasi,
 * USD/UZS kursi va so'nggi harakatlar.
 */
export default function HomePage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [newRate, setNewRate] = useState("");

  // Foyda-zarar davri: tezkor tugmalar yoki qo'lda sana oralig'i.
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const todayKey = toDateInputValue(new Date());
  const reportFrom = period === "custom" ? customFrom : periodStart(period);
  const reportTo = period === "custom" ? customTo : todayKey;

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/reports/dashboard"),
  });

  const { data: cashSummary, isLoading: cashLoading } = useQuery({
    queryKey: ["cash-summary", "all"],
    queryFn: () => api.get<CashSummary>("/cash/summary"),
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["cash-ledger", "", ""],
    queryFn: () => api.get<CashLedgerRow[]>("/cash/ledger"),
  });
  const recentLedger = [...(ledger ?? [])].filter((r) => !r.cancelled).reverse().slice(0, 6);

  const { data: latestClosing } = useQuery({
    queryKey: ["day-closing-latest"],
    queryFn: () => api.get<DayClosing | null>("/day-closings/latest"),
  });

  const { data: dayStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["day-status"],
    queryFn: () => api.get<DayStatus>("/day-closings/status"),
  });

  // Foyda-zarar hisoboti (tanlangan davr bo'yicha).
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["accounting-report", reportFrom, reportTo],
    enabled: !!reportFrom && !!reportTo,
    queryFn: () =>
      api.get<AccountingReport>(`/reports/accounting?from=${reportFrom}&to=${reportTo}T23:59:59`),
  });

  // Qarzdorlar va haqdorlar - hamkorlar balansidan: musbat balans - hamkor
  // menga qarzdor, manfiy - men hamkorga qarzdorman.
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const { debtors, creditors, owedToMeUzs, iOweUzs } = useMemo(() => {
    const list = partners ?? [];
    const debtorRows = list
      .filter((p) => p.balanceUzs > 0)
      .sort((a, b) => b.balanceUzs - a.balanceUzs);
    const creditorRows = list
      .filter((p) => p.balanceUzs < 0)
      .sort((a, b) => a.balanceUzs - b.balanceUzs);
    return {
      debtors: debtorRows,
      creditors: creditorRows,
      owedToMeUzs: debtorRows.reduce((sum, p) => sum + p.balanceUzs, 0),
      iOweUzs: creditorRows.reduce((sum, p) => sum - p.balanceUzs, 0),
    };
  }, [partners]);

  const { data: rate, isLoading: rateLoading } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => api.get<{ rate: number | null }>("/settings/exchange-rate"),
  });
  const { data: rateHistory } = useQuery({
    queryKey: ["exchange-rate-history"],
    queryFn: () => api.get<RateHistoryItem[]>("/settings/exchange-rate/history"),
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => api.post("/settings/exchange-rate", { rate: value }),
    onSuccess: () => {
      toast.success("Valyuta kursi yangilandi");
      setNewRate("");
      queryClient.invalidateQueries({ queryKey: ["exchange-rate"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-history"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  const openMutation = useMutation({
    mutationFn: () => api.post<{ openedAt: string }>("/day-closings/open", {}),
    onSuccess: () => {
      toast.success("Kun ochildi - endi savdo qilish mumkin");
      queryClient.invalidateQueries({ queryKey: ["day-status"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post<DayClosing>("/day-closings", { note: note || null }),
    onSuccess: () => {
      toast.success("Kun yopildi - kun hisoboti saqlandi");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["day-closing-latest"] });
      queryClient.invalidateQueries({ queryKey: ["day-status"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Kassa</h1>
        <p className="text-sm text-muted-foreground">
          Naqd pul, ombordagi yuk, foyda-zarar va qarzdorlar - hammasi shu yerda
        </p>
      </div>

      {/* Kun holati - eng tepada, chunki savdo qilish shu yerga bog'liq:
          kun ochilmaguncha yangi savdo yaratib bo'lmaydi (backend
          `assertDayOpenForSales` orqali tekshiradi). */}
      <Card className={dayStatus && !dayStatus.canSell ? "border-amber-500/60" : undefined}>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Kun holati
          </CardTitle>
          {!statusLoading && dayStatus && (
            <Badge variant={dayStatus.canSell ? "default" : "destructive"}>
              {dayStatus.canSell ? "Ochiq - savdo mumkin" : dayStatus.closed ? "Yopiq" : "Hali ochilmagan"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Savdo qilishdan oldin kunni oching. Kunni yopganda shu kungi hisobot (kassa qoldig&apos;i,
            savdo, ombordagi qiymat) saqlanadi - qayta ochilmaguncha yangi savdo yaratib bo&apos;lmaydi.
          </p>
          {statusLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {(!dayStatus?.opened || dayStatus?.closed) && (
                <Button size="sm" onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>
                  {dayStatus?.closed ? "Kunni qayta ochish" : "Kunni ochish"}
                </Button>
              )}
              {dayStatus?.canSell && (
                <>
                  <Input
                    placeholder="Izoh (ixtiyoriy)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="h-8 max-w-[220px]"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                  >
                    Kunni yopish
                  </Button>
                </>
              )}
            </div>
          )}
          {latestClosing && (
            <p className="border-t pt-2 text-xs text-muted-foreground">
              Oxirgi yopilgan kun:{" "}
              <span className="font-medium text-foreground">{latestClosing.closingDate}</span>
              {" - "}kassa {formatMoney(latestClosing.kassaBalanceUzs)}, savdo{" "}
              {formatMoney(latestClosing.todaySalesUzs)}
            </p>
          )}
        </CardContent>
      </Card>

      {dashboardLoading || !dashboard || cashLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Naqd pul (kassada)"
            value={formatMoney(cashSummary?.currentBalanceUzs ?? 0)}
            sub="Hozir kassada bor pul"
            icon={Wallet}
          />
          <StatCard
            label="Ombordagi yuk"
            value={formatQuantity(dashboard.stockWeightKg, "kg")}
            sub={formatMoney(dashboard.stockValueUzs)}
            icon={Boxes}
          />
          <StatCard
            label="Bugungi savdo"
            value={formatMoney(dashboard.todaySalesUzs)}
            sub={`${dashboard.todaySalesCount} ta savdo`}
            icon={ShoppingCart}
          />
        </div>
      )}

      {/* Foyda-zarar: raqamlar + diagramma, davr tanlanadi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Foyda va zarar
          </CardTitle>
          <CardDescription>Tanlangan davrdagi savdodan qancha sof foyda (yoki zarar) chiqdi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            {(["day", "month", "year", "custom"] as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                onClick={() => setPeriod(p)}
              >
                {periodLabels[p]}
              </Button>
            ))}
            {period === "custom" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="report-from" className="text-xs text-muted-foreground">
                    Boshlanish
                  </Label>
                  <Input
                    id="report-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="report-to" className="text-xs text-muted-foreground">
                    Tugash
                  </Label>
                  <Input
                    id="report-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {!reportFrom || !reportTo ? (
            <p className="text-sm text-muted-foreground">Boshlanish va tugash sanasini tanlang</p>
          ) : reportLoading || !report ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-4">
              <HorizontalBars
                ariaLabel="Foyda va zarar diagrammasi"
                rows={[
                  { label: "Daromad (savdo)", value: report.revenueUzs, tone: "neutral" },
                  { label: "Tannarx", value: report.cogsUzs, tone: "bad", hint: "Sotilgan mahsulot tannarxi" },
                  { label: "Xarajatlar", value: report.expensesUzs, tone: "bad" },
                  {
                    label: report.netProfitUzs >= 0 ? "Sof foyda" : "Sof zarar",
                    value: report.netProfitUzs,
                    tone: report.netProfitUzs >= 0 ? "good" : "bad",
                  },
                ]}
              />

              <p
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  report.netProfitUzs >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {report.netProfitUzs >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {report.netProfitUzs >= 0 ? "Foyda" : "Zarar"}: {formatMoney(report.netProfitUzs)}
                <span className="font-normal text-muted-foreground">
                  · yalpi foyda {formatMoney(report.grossProfitUzs)} · {report.saleCount} ta savdo
                </span>
              </p>

              {report.expensesByCategory.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">Xarajatlar kategoriya bo&apos;yicha</p>
                  <div className="flex flex-wrap gap-2">
                    {report.expensesByCategory.map((e) => (
                      <Badge key={e.category} variant="outline">
                        {expenseCategoryLabels[e.category as keyof typeof expenseCategoryLabels] ??
                          e.category}
                        : {formatMoney(e.totalUzs)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Har bir raqam qanday hisoblanganini qisqa tushuntirish. */}
              <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Daromad</span> — davr ichida yaratilgan
                  savdolarning umumiy summasi (bekor qilinganlar kirmaydi).
                </p>
                <p>
                  <span className="font-medium text-foreground">Tannarx</span> — sotilgan mahsulotning
                  o&apos;zi qancha turgani (FIFO — o&apos;sha partiyaning haqiqiy narxi × miqdor).
                </p>
                <p>
                  <span className="font-medium text-foreground">Xarajatlar</span> — ish haqi, ijara,
                  transport va h.k. Yetkazib beruvchiga to&apos;lov kirmaydi — uning tannarxi allaqachon
                  hisobga olingan.
                </p>
                <p>
                  <span className="font-medium text-foreground">Sof foyda</span> = Daromad − Tannarx −
                  Xarajatlar.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Qarzdorlar (menga qarzdorlar) va haqdorlar (men qarzdor bo'lganlar) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-primary" />
            Qarzdorlar va haqdorlar
          </CardTitle>
          <CardDescription>
            Qarzdorlar — hamkorlar menga qarzdor; haqdorlar — men hamkorlarga qarzdorman
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {partnersLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <HorizontalBars
                ariaLabel="Qarzdorlar va haqdorlar diagrammasi"
                rows={[
                  { label: "Menda qarzdorlar (mening haqim)", value: owedToMeUzs, tone: "good" },
                  { label: "Qarzlarim (haqdorlar haqi)", value: iOweUzs, tone: "bad" },
                ]}
              />
              <div className="grid grid-cols-1 gap-4 border-t pt-3 md:grid-cols-2">
                <PartnerTopList
                  title={`Qarzdorlar (${debtors.length})`}
                  empty="Qarzdor hamkor yo'q"
                  rows={debtors.map((p) => ({ id: p.id, name: p.name, value: p.balanceUzs }))}
                  tone="good"
                />
                <PartnerTopList
                  title={`Haqdorlar (${creditors.length})`}
                  empty="Haqdor hamkor yo'q"
                  rows={creditors.map((p) => ({ id: p.id, name: p.name, value: -p.balanceUzs }))}
                  tone="bad"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* USD/UZS kursi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            USD / UZS kursi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rateLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <p className="text-2xl font-semibold">
              {rate?.rate ? formatMoney(rate.rate) : "Kiritilmagan"}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newRate) rateMutation.mutate(Number(newRate));
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="space-y-2">
              <Label htmlFor="rate">Yangi kurs (1 USD = ? so&apos;m)</Label>
              <MoneyInput
                id="rate"
                allowDecimal
                value={newRate}
                onChange={setNewRate}
                placeholder="12 700"
              />
            </div>
            <Button type="submit" disabled={rateMutation.isPending || !newRate}>
              {rateMutation.isPending ? "Saqlanmoqda..." : "Yangilash"}
            </Button>
          </form>
          {!!rateHistory?.length && (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">Kurs tarixi</p>
              {rateHistory.slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{formatMoney(h.rate)}</span>
                  <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!!dashboard?.lowStockProducts.length && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="h-4 w-4 text-amber-600" />
              Kam qolgan mahsulotlar
            </CardTitle>
            <Link
              href="/ombor/mahsulotlar"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Barchasi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <Badge variant="destructive">{formatQuantity(p.stockQuantity, p.unit)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">So&apos;nggi harakatlar</CardTitle>
          <Link
            href="/kassa/amaliyotlari"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Barchasini ko&apos;rish <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {ledgerLoading ? (
            <Skeleton className="h-32" />
          ) : recentLedger.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Hozircha kassa harakati yo&apos;q
            </p>
          ) : (
            recentLedger.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.date)}</p>
                </div>
                <span
                  className={`shrink-0 font-medium ${
                    r.direction === "in" ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {r.direction === "in" ? "+" : "-"}
                  {formatMoney(r.amountUzs)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Eng katta 5 ta qarzdor/haqdor hamkor ro'yxati (nomi bosilsa hisob-varaqqa o'tadi). */
function PartnerTopList({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; value: number }[];
  tone: "good" | "bad";
}) {
  const top = rows.slice(0, 5);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        top.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <Link href={`/savdo/hamkorlar/${r.id}`} className="truncate hover:underline">
              {r.name}
            </Link>
            <span
              className={`shrink-0 font-medium tabular-nums ${
                tone === "good" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {formatMoney(r.value)}
            </span>
          </div>
        ))
      )}
      {rows.length > top.length && (
        <Link href="/kassa/hamkorlar" className="text-xs text-primary hover:underline">
          Yana {rows.length - top.length} ta - barchasini ko&apos;rish
        </Link>
      )}
    </div>
  );
}
