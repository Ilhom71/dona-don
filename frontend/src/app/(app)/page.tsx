"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, HandCoins, Landmark, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { AccountingReport, CashSummary, DashboardSummary, Partner } from "@/lib/types";
import { formatMoney, formatMoneyCompact, toDateInputValue } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { KassaSubNav } from "@/components/kassa-subnav";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfitSection } from "@/components/dashboard/profit-section";
import { DebtsSection } from "@/components/dashboard/debts-section";
import { LowStockCard, RateCard, RecentMovements } from "@/components/dashboard/secondary-blocks";

/**
 * Bosh sahifa: egasi 5 soniyada ko'rishi kerak - pulim qancha, foydam qancha,
 * kim menga qarz, kimga men qarzman. Ikkinchi darajali bloklar pastda.
 */
export default function HomePage() {
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/reports/dashboard"),
  });

  const { data: cashSummary, isLoading: cashLoading } = useQuery({
    queryKey: ["cash-summary", "all"],
    queryFn: () => api.get<CashSummary>("/cash/summary"),
  });

  // Shu oy sof foyda - xarajatlar ayirilgan hisobotdan (dashboard.monthProfitUzs ishlatilmaydi)
  const today = toDateInputValue(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: monthReport, isLoading: monthLoading } = useQuery({
    queryKey: ["accounting-report", monthStart, today],
    queryFn: () => api.get<AccountingReport>(`/reports/accounting?from=${monthStart}&to=${today}`),
  });

  // Musbat balans - hamkor menga qarzdor, manfiy - men hamkorga qarzdorman
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const { debtors, creditors, owedToMeUzs, iOweUzs } = useMemo(() => {
    const list = partners ?? [];
    const debtorRows = list.filter((p) => p.balanceUzs > 0).sort((a, b) => b.balanceUzs - a.balanceUzs);
    const creditorRows = list.filter((p) => p.balanceUzs < 0).sort((a, b) => a.balanceUzs - b.balanceUzs);
    return {
      debtors: debtorRows,
      creditors: creditorRows,
      owedToMeUzs: debtorRows.reduce((sum, p) => sum + p.balanceUzs, 0),
      iOweUzs: creditorRows.reduce((sum, p) => sum - p.balanceUzs, 0),
    };
  }, [partners]);

  // O'tgan davrga nisbatan % o'zgarish (oldingi foyda 0 bo'lsa - hisoblanmaydi)
  const trend =
    monthReport && monthReport.previous.netProfitUzs !== 0
      ? ((monthReport.netProfitUzs - monthReport.previous.netProfitUzs) /
          Math.abs(monthReport.previous.netProfitUzs)) *
        100
      : null;

  const cardsLoading = cashLoading || monthLoading || partnersLoading;
  const profit = monthReport?.netProfitUzs ?? 0;

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Bosh sahifa</h1>
        <p className="text-sm text-muted-foreground">Pulingiz, foydangiz va qarzlaringiz bir joyda</p>
      </div>

      {/* 4 ta asosiy karta */}
      {cardsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Kassadagi pul"
            value={formatMoneyCompact(cashSummary?.currentBalanceUzs ?? 0)}
            hint={formatMoney(cashSummary?.currentBalanceUzs ?? 0)}
            sub="Kassada hozir bor pul"
            icon={Banknote}
          />
          <StatCard
            label="Shu oy sof foyda"
            value={formatMoneyCompact(profit)}
            hint={formatMoney(profit)}
            sub="Savdodan tushgan foyda, xarajatlar ayirilgan"
            icon={TrendingUp}
            tone={profit >= 0 ? "success" : "danger"}
            trendPercent={trend}
          />
          <StatCard
            label="Menga qarzdorlar"
            value={formatMoneyCompact(owedToMeUzs)}
            hint={formatMoney(owedToMeUzs)}
            sub={`${debtors.length} ta hamkor menga qarz`}
            icon={HandCoins}
            tone="success"
          />
          <StatCard
            label="Mening qarzim"
            value={formatMoneyCompact(iOweUzs)}
            hint={formatMoney(iOweUzs)}
            sub={`${creditors.length} ta hamkorga qarzman`}
            icon={Landmark}
            tone={iOweUzs > 0 ? "danger" : "default"}
          />
        </div>
      )}

      <ProfitSection />

      <DebtsSection debtors={debtors} creditors={creditors} loading={partnersLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentMovements />
        <div className="space-y-4">
          <LowStockCard products={dashboard?.lowStockProducts ?? []} />
          <RateCard />
        </div>
      </div>
    </div>
  );
}
