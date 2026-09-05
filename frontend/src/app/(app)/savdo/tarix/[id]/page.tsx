"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Truck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import type { Sale, PaymentStatus } from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  paymentMethodLabels,
  paymentStatusLabels,
} from "@/lib/format";

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
};

export default function SaleDetailPage(props: PageProps<"/savdo/tarix/[id]">) {
  const { id } = use(props.params);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => api.get<Sale>(`/sales/${id}`),
  });

  if (isLoading || !sale) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const remaining = Number(sale.totalAmountUzs) - Number(sale.paidAmountUzs);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/savdo/tarix"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Savdo tarixi
        </Link>
        <Badge variant={statusVariant[sale.paymentStatus]}>
          {paymentStatusLabels[sale.paymentStatus]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sale.partner?.name ?? "Hamkor"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Sana</p>
            <p className="font-medium">{formatDate(sale.saleDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Mashina raqami
            </p>
            <p className="font-medium">{sale.vehicleNumber ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ombor</p>
            <p className="font-medium">{sale.warehouse?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Umumiy summa</p>
            <p className="font-medium">{formatMoney(sale.totalAmount, sale.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">To'langan / Qolgan</p>
            <p className="font-medium">
              {formatMoney(sale.paidAmountUzs)} / {formatMoney(Math.max(remaining, 0))}
            </p>
          </div>
          {sale.notes && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Izoh</p>
              <p className="font-medium">{sale.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mahsulotlar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot</TableHead>
                <TableHead>Miqdor</TableHead>
                <TableHead>Narxi</TableHead>
                <TableHead className="text-right">Jami</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product?.name ?? "-"}</TableCell>
                  <TableCell>
                    {formatQuantity(item.quantity, item.product?.unit ?? "kg")}
                  </TableCell>
                  <TableCell>{formatMoney(item.unitPrice, sale.currency)}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(item.subtotal, sale.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">To'lovlar</CardTitle>
          {remaining > 0 && (
            <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
              <Wallet className="h-4 w-4" />
              To'lov qo'shish
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!sale.payments || sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hozircha to'lov qilinmagan</p>
          ) : (
            <div className="space-y-2">
              {sale.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{formatMoney(p.amount, p.currency)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(p.paymentDate)}</p>
                  </div>
                  <Badge variant="outline">{paymentMethodLabels[p.method]}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentFormDialog
        partnerId={sale.partnerId}
        saleId={sale.id}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  );
}
