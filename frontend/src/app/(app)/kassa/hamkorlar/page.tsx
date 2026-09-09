"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Plus, Users } from "lucide-react";
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
import { BalanceBadge } from "@/components/balance-badge";
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { CashTransactionFormDialog } from "@/components/cash-transaction-form-dialog";
import { api } from "@/lib/api";
import type { Partner } from "@/lib/types";
import { formatMoney, partnerTypeLabels } from "@/lib/format";

/**
 * Hamkorlar - Kassa bo'limining moliyaviy ko'rinishi: har bir hamkor uchun
 * mijoz sifatidagi qarzi va yakuniy umumiy balans (operatsion "Hamkorlar"
 * sahifasidan farqli - bu yerda faqat balanslar ko'rsatiladi). Yetkazib
 * beruvchiga qarz alohida ustun sifatida chalkashtirib yuborgani uchun
 * o'chirildi - "Umumiy balans" (BalanceBadge) ikkala tomonni birlashtirib
 * hisoblab, allaqachon to'g'ri ko'rsatadi.
 */
export default function KassaPartnersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Partner | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  // Standart holatda faqat haqiqiy moliyaviy amaliyoti (qarzi/qarzdorligi)
  // bor hamkorlar ko'rsatiladi - bu sahifa moliyaviy ko'rinish, "hisob-kitob
  // qiladigan" hamkorlar uchun.
  const visiblePartners = showAll ? data ?? [] : (data ?? []).filter((p) => Number(p.balanceUzs) !== 0);

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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Faqat qarzi/qarzdorligi borlar" : "Barchasini ko'rsatish"}
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Yangi hamkor
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : visiblePartners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              {showAll || !data?.length
                ? "Hozircha hamkor qo'shilmagan"
                : "Qarzi/qarzdorligi bor hamkor yo'q"}
            </p>
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
                  <TableHead className="text-right">Umumiy balans</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePartners.map((p) => {
                  const customerDebt = Number(p.totalSalesUzs) - Number(p.totalPaidUzs);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/savdo/hamkorlar/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                        {p.bankAccount && (
                          <p className="text-xs font-normal text-muted-foreground">{p.bankAccount}</p>
                        )}
                      </TableCell>
                      <TableCell>{partnerTypeLabels[p.type]}</TableCell>
                      <TableCell className="text-right">
                        {customerDebt > 0 ? formatMoney(customerDebt) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <BalanceBadge value={p.balanceUzs} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pul o'tkazish"
                          onClick={() => setTransferTarget(p)}
                        >
                          <Banknote className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {visiblePartners.map((p) => {
              const customerDebt = Number(p.totalSalesUzs) - Number(p.totalPaidUzs);
              return (
                <Card key={p.id}>
                  <CardContent className="space-y-2 py-3 text-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/savdo/hamkorlar/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.bankAccount && (
                          <p className="text-xs text-muted-foreground">{p.bankAccount}</p>
                        )}
                      </div>
                      <Badge variant="secondary">{partnerTypeLabels[p.type]}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Mijoz qarzi</span>
                      <span>{customerDebt > 0 ? formatMoney(customerDebt) : "-"}</span>
                    </div>
                    <p className="flex justify-between border-t pt-1 font-medium">
                      <span>Umumiy balans</span>
                      <BalanceBadge value={p.balanceUzs} />
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setTransferTarget(p)}
                    >
                      <Banknote className="h-4 w-4" />
                      Pul o&apos;tkazish
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <PartnerFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <CashTransactionFormDialog
        direction="out"
        open={!!transferTarget}
        onOpenChange={(o) => !o && setTransferTarget(null)}
        initialPartnerId={transferTarget?.id}
        title={transferTarget ? `"${transferTarget.name}"ga pul o'tkazish` : undefined}
      />
    </div>
  );
}
