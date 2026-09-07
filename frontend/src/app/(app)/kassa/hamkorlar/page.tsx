"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KassaSubNav } from "@/components/kassa-subnav";
import { StatCard } from "@/components/stat-card";
import { BalanceBadge } from "@/components/balance-badge";
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api } from "@/lib/api";
import type { Partner } from "@/lib/types";
import { formatMoney, partnerTypeLabels } from "@/lib/format";

/**
 * Hamkorlar - Kassa bo'limining moliyaviy ko'rinishi: har bir hamkor uchun
 * mijoz sifatidagi qarzi va yetkazib beruvchi sifatidagi bizning qarzimiz
 * alohida ustunlarda, va yakuniy umumiy balans (operatsion "Hamkorlar"
 * sahifasidan farqli - bu yerda faqat balanslar ko'rsatiladi).
 */
export default function KassaPartnersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  const customerDebtTotal = (data ?? []).reduce(
    (sum, p) => sum + (Number(p.totalSalesUzs) - Number(p.totalPaidUzs)),
    0
  );
  const payableTotal = (data ?? []).reduce(
    (sum, p) => sum + (Number(p.totalPurchasesUzs) - Number(p.totalSupplierPaidUzs)),
    0
  );

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hamkorlar</h1>
          <p className="text-sm text-muted-foreground">
            Moliyaviy ko&apos;rinish: mijoz va yetkazib beruvchi balanslari
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Yangi hamkor
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Mijozlar qarzi (bizga)"
          value={formatMoney(customerDebtTotal)}
          icon={TrendingUp}
          tone={customerDebtTotal > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Bizning qarzimiz (yetkazib beruvchiga)"
          value={formatMoney(payableTotal)}
          icon={TrendingDown}
          tone={payableTotal > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Umumiy sof balans"
          value={formatMoney(customerDebtTotal - payableTotal)}
          icon={Wallet}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha hamkor qo'shilmagan</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hamkor</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead className="text-right">Mijoz qarzi</TableHead>
                  <TableHead className="text-right">Bizning qarzimiz</TableHead>
                  <TableHead className="text-right">Umumiy balans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => {
                  const customerDebt = Number(p.totalSalesUzs) - Number(p.totalPaidUzs);
                  const payable = Number(p.totalPurchasesUzs) - Number(p.totalSupplierPaidUzs);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/savdo/hamkorlar/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell>{partnerTypeLabels[p.type]}</TableCell>
                      <TableCell className="text-right">
                        {customerDebt > 0 ? formatMoney(customerDebt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {payable > 0 ? formatMoney(payable) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <BalanceBadge value={p.balanceUzs} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {data.map((p) => {
              const customerDebt = Number(p.totalSalesUzs) - Number(p.totalPaidUzs);
              const payable = Number(p.totalPurchasesUzs) - Number(p.totalSupplierPaidUzs);
              return (
                <Card key={p.id}>
                  <CardContent className="space-y-2 py-3 text-sm">
                    <div className="flex items-start justify-between">
                      <Link
                        href={`/savdo/hamkorlar/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <Badge variant="secondary">{partnerTypeLabels[p.type]}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Mijoz qarzi</span>
                      <span>{customerDebt > 0 ? formatMoney(customerDebt) : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Bizning qarzimiz</span>
                      <span>{payable > 0 ? formatMoney(payable) : "-"}</span>
                    </div>
                    <p className="flex justify-between border-t pt-1 font-medium">
                      <span>Umumiy balans</span>
                      <BalanceBadge value={p.balanceUzs} />
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <PartnerFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
