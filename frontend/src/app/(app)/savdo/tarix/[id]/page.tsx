"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, Pencil, Truck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Sale, PaymentStatus } from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  paymentMethodLabels,
  paymentStatusLabels,
} from "@/lib/format";

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  cancelled: "outline",
};

export default function SaleDetailPage(props: PageProps<"/savdo/tarix/[id]">) {
  const { id } = use(props.params);
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => api.get<Sale>(`/sales/${id}`),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/sales/${id}/cancel`, {}),
    onSuccess: () => {
      toast.success("Savdo bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["sale", id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setCancelOpen(false),
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
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[sale.paymentStatus]}>
            {paymentStatusLabels[sale.paymentStatus]}
          </Badge>
          {!sale.cancelledAt && (
            <>
              <Link
                href={`/savdo/yangi?editId=${sale.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil className="h-4 w-4" />
                Tahrirlash
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="h-4 w-4" />
                Bekor qilish
              </Button>
            </>
          )}
        </div>
      </div>

      {sale.cancelledAt && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm">
            <p className="font-medium text-destructive">
              Bu savdo {formatDateTime(sale.cancelledAt)} da bekor qilingan
            </p>
            {sale.cancelReason && (
              <p className="text-muted-foreground">Sabab: {sale.cancelReason}</p>
            )}
          </CardContent>
        </Card>
      )}

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
        <CardContent className="hidden overflow-x-auto p-0 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot</TableHead>
                <TableHead>Miqdor</TableHead>
                <TableHead>Narxi</TableHead>
                <TableHead className="text-right">Jami</TableHead>
                <TableHead className="text-right">Yuk puli</TableHead>
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
                  <TableCell className="text-right">
                    {Number(item.freightCostUzs) > 0 ? formatMoney(item.freightCostUzs) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardContent className="space-y-2 md:hidden">
          {sale.items?.map((item) => (
            <div key={item.id} className="space-y-1 rounded-md border p-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.product?.name ?? "-"}</span>
                <span>{formatMoney(item.subtotal, sale.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {formatQuantity(item.quantity, item.product?.unit ?? "kg")} x{" "}
                  {formatMoney(item.unitPrice, sale.currency)}
                </span>
                {Number(item.freightCostUzs) > 0 && (
                  <span>Yuk: {formatMoney(item.freightCostUzs)}</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">To'lovlar</CardTitle>
          {remaining > 0 && !sale.cancelledAt && (
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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Savdoni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              Bu savdo bekor qilinadi: sotilgan mahsulotlar omborga qaytariladi va holati
              &quot;Bekor qilingan&quot; deb belgilanadi. Yozuv o&apos;zi o&apos;chirilmaydi (audit
              tarixi saqlanadi). Davom etasizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo'q</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Ha, bekor qilish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
