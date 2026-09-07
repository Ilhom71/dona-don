"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowRight, ArrowUpCircle, ShoppingCart, TriangleAlert, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import type { CashSummary, DashboardSummary } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { KassaSubNav } from "@/components/kassa-subnav";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kassa - kunlik naqd savdo kassasi (faqat bugungi harakat). Kengroq
 * hisobotlar (foyda-zarar, davr bo'yicha qarzdorlik, USD/UZS kursi) endi
 * "Buxgalteriya" bo'limida - u firmaning joriy hisobi, Kassa esa faqat
 * kunlik kassa aylanmasi (KassaSubNav orqali o'sha bo'limga o'tiladi).
 */
export default function HomePage() {
  // Bugungi kun (00:00 dan hozirgacha) - backend `to`ni kun boshi sifatida
  // oladi, shuning uchun kun oxirigacha (23:59:59) qo'shiladi.
  const today = new Date().toISOString().slice(0, 10);
  const qs = `from=${today}&to=${today}T23:59:59`;

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/reports/dashboard"),
  });

  const { data: todayCash, isLoading: todayCashLoading } = useQuery({
    queryKey: ["cash-summary", today, today],
    queryFn: () => api.get<CashSummary>(`/cash/summary?${qs}`),
  });

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Kassa</h1>
        <p className="text-sm text-muted-foreground">
          Bugungi kunlik savdo kassasi - kengroq hisobotlar uchun{" "}
          <Link href="/kassa/buxgalteriya" className="text-primary hover:underline">
            Buxgalteriya
          </Link>{" "}
          bo&apos;limiga qarang
        </p>
      </div>

      {dashboardLoading || !dashboard || todayCashLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Joriy kassa qoldig'i"
            value={formatMoney(todayCash?.currentBalanceUzs ?? 0)}
            sub="Hozir naqd/kassada bor pul"
            icon={Wallet}
          />
          <StatCard
            label="Bugungi savdo"
            value={formatMoney(dashboard.todaySalesUzs)}
            sub={`${dashboard.todaySalesCount} ta savdo`}
            icon={ShoppingCart}
          />
          <StatCard
            label="Bugungi kirim"
            value={formatMoney(todayCash?.periodInUzs ?? 0)}
            sub="Bugun kassaga kirgan pul"
            icon={ArrowDownCircle}
            tone="success"
          />
          <StatCard
            label="Bugungi chiqim"
            value={formatMoney(todayCash?.periodOutUzs ?? 0)}
            sub="Bugun kassadan chiqqan pul"
            icon={ArrowUpCircle}
          />
        </div>
      )}

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
    </div>
  );
}
