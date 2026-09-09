"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CalendarCheck,
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
} from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { KassaSubNav } from "@/components/kassa-subnav";
import { formatDateTime, formatMoney, formatQuantity, toDateInputValue } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kassa - ilovaning bosh sahifasi, ataylab SODDA: naqd pul qancha, omborda
 * qancha yuk (og'irlik+qiymat) bor, bugungi savdo, kunni yopish va so'nggi
 * harakatlar. To'liq filtr/tarix/hisobotlar boshqa Kassa tab'larida
 * (Amaliyotlari/Savdolar/Hamkorlar/Buxgalteriya) - ular o'zgarmagan.
 */
export default function HomePage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

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

  const todayKey = toDateInputValue(new Date());

  // Bugungi (kunlik) foyda-zarar - mavjud /reports/accounting endpointi
  // (Buxgalteriyada davr bo'yicha ishlatiladigan) bugungi sana bilan.
  const { data: todayAccounting, isLoading: accountingLoading } = useQuery({
    queryKey: ["accounting-report", todayKey, todayKey],
    queryFn: () =>
      api.get<AccountingReport>(`/reports/accounting?from=${todayKey}&to=${todayKey}T23:59:59`),
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
      toast.success("Kun yopildi - kassadagi pul buxgalteriyaga o'tkazildi");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["day-closing-latest"] });
      queryClient.invalidateQueries({ queryKey: ["day-status"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Kassa</h1>
        <p className="text-sm text-muted-foreground">
          Naqd pul, ombordagi yuk va bugungi harakat - kengroq hisobotlar uchun{" "}
          <Link href="/kassa/buxgalteriya" className="text-primary hover:underline">
            Buxgalteriya
          </Link>{" "}
          bo&apos;limiga qarang
        </p>
      </div>

      {/* Kun holati - eng tepada, chunki savdo qilish shu yerga bog'liq:
          kun ochilmaguncha yangi savdo yaratib bo'lmaydi (backend
          `assertDayOpenForSales` orqali tekshiradi). Kunni yopganda hozirgi
          kassa qoldig'i avtomatik buxgalteriyaga o'tkaziladi. */}
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
            Savdo qilishdan oldin kunni oching. Kunni yopganda hozirgi kassa qoldig&apos;i
            avtomatik buxgalteriyaga o&apos;tkaziladi va shu kungi hisobot saqlanadi - qayta
            ochilmaguncha yangi savdo yaratib bo&apos;lmaydi.
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
                    Kunni yopish (buxgalteriyaga o&apos;tkazish)
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Kunlik foyda-zarar
          </CardTitle>
          <CardDescription>Bugungi savdolardan qancha sof foyda (yoki zarar) chiqdi</CardDescription>
        </CardHeader>
        <CardContent>
          {accountingLoading || !todayAccounting ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Daromad</p>
                  <p className="font-medium">{formatMoney(todayAccounting.revenueUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tannarx</p>
                  <p className="font-medium">{formatMoney(todayAccounting.cogsUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Xarajatlar</p>
                  <p className="font-medium">{formatMoney(todayAccounting.expensesUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sof foyda</p>
                  <p
                    className={`flex items-center gap-1 font-semibold ${
                      todayAccounting.netProfitUzs >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {todayAccounting.netProfitUzs >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {formatMoney(todayAccounting.netProfitUzs)}
                  </p>
                </div>
              </div>

              {/* Foydalanuvchi so'rovi: har bir raqam qanday hisoblanganini
                  qisqa tushuntirish (description) sifatida yozib qo'yish. */}
              <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Daromad</span> — bugun yaratilgan
                  barcha savdolarning umumiy summasi (bekor qilingan savdolar kirmaydi).
                </p>
                <p>
                  <span className="font-medium text-foreground">Tannarx</span> — sotilgan
                  mahsulotning o&apos;zi qancha turgani: har bir savdo qatorida sotilgan partiyaning
                  (FIFO — eng eski, o&apos;sha narxda kirim qilingan) haqiqiy narxi × miqdor.
                </p>
                <p>
                  <span className="font-medium text-foreground">Xarajatlar</span> — bugun qayd
                  etilgan xarajatlar (ish haqi, ijara, transport va h.k.). Yetkazib beruvchiga
                  to&apos;lov bu yerga kirmaydi — uning tannarxi yuqorida allaqachon hisobga
                  olingan, aks holda ikki marta ayirilib ketardi.
                </p>
                <p>
                  <span className="font-medium text-foreground">Sof foyda</span> = Daromad −
                  Tannarx − Xarajatlar.
                </p>
              </div>
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
