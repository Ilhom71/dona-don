"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileSpreadsheet, Truck, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { BalanceBadge } from "@/components/balance-badge";
import { api, apiUrl } from "@/lib/api";
import type { Partner, PartnerLedgerRow } from "@/lib/types";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  partnerTypeLabels,
  paymentMethodLabels,
} from "@/lib/format";

/**
 * Hamkorning to'liq hisob-varag'i: sotilgan har bir mahsulot qatori (mashina
 * raqami, kg, narx, yuk puli bilan) va har bir to'lov, sana bo'yicha ketma-ket
 * va o'sib boruvchi qoldiq bilan - "Shoxrux aka tegirmon" uslubidagi jadval
 * (image.png). Savdo tarixida hamkor nomini bosganda shu sahifa ochiladi.
 */
export default function PartnerLedgerPage(props: PageProps<"/savdo/hamkorlar/[id]">) {
  const { id } = use(props.params);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["partner", id],
    queryFn: () => api.get<Partner>(`/partners/${id}`),
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["partner-ledger", id],
    queryFn: () => api.get<PartnerLedgerRow[]>(`/partners/${id}/ledger`),
  });

  if (partnerLoading || !partner) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/savdo/tarix"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Savdo tarixi
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{partner.name}</h1>
          <p className="text-sm text-muted-foreground">{partnerTypeLabels[partner.type]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BalanceBadge value={partner.balanceUzs} />
          <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
            <Wallet className="h-4 w-4" />
            To'lov qo'shish
          </Button>
          <a
            href={apiUrl(`/excel/partners/${partner.id}/statement`)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </a>
        </div>
      </div>

      {ledgerLoading ? (
        <Skeleton className="h-64" />
      ) : !ledger || ledger.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Bu hamkor uchun hozircha yozuv yo'q</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Mashina raqami</TableHead>
                  <TableHead>Miqdor</TableHead>
                  <TableHead>Narxi</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="text-right">Yuk puli</TableHead>
                  <TableHead className="text-right">Berilgan pul</TableHead>
                  <TableHead className="text-right">Qoldiq +/-</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((row, i) => (
                  <TableRow
                    key={row.id}
                    className={row.cancelled ? "opacity-50" : undefined}
                  >
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    {row.kind === "delivery" || row.kind === "purchase-delivery" ? (
                      <>
                        <TableCell className="font-medium">
                          {row.productName}
                          {row.kind === "purchase-delivery" && (
                            <Badge variant="secondary" className="ml-2">
                              Xarid
                            </Badge>
                          )}
                          {row.cancelled && (
                            <Badge variant="outline" className="ml-2">
                              Bekor qilingan
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.vehicleNumber ?? "-"}</TableCell>
                        <TableCell>
                          {row.quantity != null && row.unit
                            ? formatQuantity(row.quantity, row.unit)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.pricePerUnit != null ? formatMoney(row.pricePerUnit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.goodsValueUzs != null ? formatMoney(row.goodsValueUzs) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.freightCostUzs ? formatMoney(row.freightCostUzs) : "-"}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium text-muted-foreground" colSpan={5}>
                          {row.kind === "supplier-payment"
                            ? "Yetkazib beruvchiga to'lov"
                            : "To'lov"}{" "}
                          ({paymentMethodLabels[row.paymentMethod ?? "cash"]})
                        </TableCell>
                        <TableCell className="text-right">
                          {row.paidUzs != null ? formatMoney(row.paidUzs) : "-"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-medium">
                      {formatMoney(row.balanceUzs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {ledger.map((row, i) => (
              <Card key={row.id} className={row.cancelled ? "opacity-50" : undefined}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <span className="font-medium">
                      {row.kind === "delivery" || row.kind === "purchase-delivery"
                        ? row.productName
                        : row.kind === "supplier-payment"
                          ? "Yetkazib beruvchiga to'lov"
                          : "To'lov"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{i + 1} · {formatDate(row.date)}
                    </span>
                  </div>
                  {row.kind === "delivery" || row.kind === "purchase-delivery" ? (
                    <>
                      {row.kind === "purchase-delivery" && (
                        <Badge variant="secondary">Xarid</Badge>
                      )}
                      {row.vehicleNumber && (
                        <p className="flex items-center gap-1 text-muted-foreground">
                          <Truck className="h-3.5 w-3.5" /> {row.vehicleNumber}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        {row.quantity != null && row.unit
                          ? formatQuantity(row.quantity, row.unit)
                          : "-"}{" "}
                        × {row.pricePerUnit != null ? formatMoney(row.pricePerUnit) : "-"}
                        {" = "}
                        {row.goodsValueUzs != null ? formatMoney(row.goodsValueUzs) : "-"}
                      </p>
                      {!!row.freightCostUzs && (
                        <p className="text-muted-foreground">
                          Yuk puli: {formatMoney(row.freightCostUzs)}
                        </p>
                      )}
                      {row.cancelled && (
                        <Badge variant="outline">Bekor qilingan</Badge>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Berilgan pul ({paymentMethodLabels[row.paymentMethod ?? "cash"]}):{" "}
                      {row.paidUzs != null ? formatMoney(row.paidUzs) : "-"}
                    </p>
                  )}
                  <p className="flex justify-between border-t pt-1 font-medium">
                    <span>Qoldiq</span>
                    <span>{formatMoney(row.balanceUzs)}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <PaymentFormDialog partnerId={partner.id} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}
