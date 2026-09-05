"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Warehouse, TrendingUp, ShoppingCart, Wallet, TriangleAlert, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";
import { StatCard } from "@/components/stat-card";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/reports/dashboard"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="hidden text-2xl font-semibold md:block">Bosh sahifa</h1>
        <p className="hidden text-sm text-muted-foreground md:block">
          Ombor va savdo bo'yicha umumiy holat
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Ombordagi qoldiq qiymati"
            value={formatMoney(data.stockValueUzs)}
            icon={Warehouse}
          />
          <StatCard
            label="Bugungi savdo"
            value={formatMoney(data.todaySalesUzs)}
            sub={`${data.todaySalesCount} ta savdo`}
            icon={ShoppingCart}
          />
          <StatCard
            label="Oylik daromad"
            value={formatMoney(data.monthProfitUzs)}
            sub={`Oylik savdo: ${formatMoney(data.monthSalesUzs)}`}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Umumiy qarzdorlik"
            value={formatMoney(data.totalDebtUzs)}
            icon={Wallet}
            tone={data.totalDebtUzs > 0 ? "warning" : "default"}
          />
        </div>
      )}

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
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : !data || data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha kam qolgan mahsulot yo'q.</p>
          ) : (
            <div className="space-y-2">
              {data.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="destructive">{formatQuantity(p.stockQuantity, p.unit)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
