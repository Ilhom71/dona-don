"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { KassaSubNav } from "@/components/kassa-subnav";
import { StatCard } from "@/components/stat-card";
import { api, ApiError } from "@/lib/api";
import type { Sale } from "@/lib/types";
import { formatDate, formatMoney, paymentStatusLabels } from "@/lib/format";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  cancelled: "outline",
};

/**
 * Savdolar - Kassa bo'limining moliyaviy ko'rinishi: har bir savdo bo'yicha
 * summa/to'langan/qoldiq balans ustunlari bilan (operatsion "Savdo tarixi"
 * sahifasidan farqli - bu yerda faqat moliyaviy holat ko'rsatiladi).
 */
export default function KassaSalesPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", `${to}T23:59:59`);
  const qs = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["kassa-sales", from, to],
    queryFn: () => api.get<Sale[]>(`/sales${qs ? `?${qs}` : ""}`),
  });

  // Bekor qilingan savdolar bu ro'yxatda ko'rinmaydi - Arxivning "Bekor
  // qilingan savdolar" qismida ko'rinadi.
  const active = (data ?? []).filter((s) => !s.cancelledAt);
  const totalUzs = active.reduce((sum, s) => sum + Number(s.totalAmountUzs), 0);
  const paidUzs = active.reduce((sum, s) => sum + Number(s.paidAmountUzs), 0);
  const debtUzs = totalUzs - paidUzs;

  const cancelMutation = useMutation({
    mutationFn: (sale: Sale) => api.post(`/sales/${sale.id}/cancel`, {}),
    onSuccess: () => {
      toast.success("Savdo bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["kassa-sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["cancelled-sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-report"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setCancelTarget(null),
  });

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Savdolar</h1>
        <p className="text-sm text-muted-foreground">
          Moliyaviy ko&apos;rinish: barcha savdolar va balanslar
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            Boshlanish sanasi
          </Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            Tugash sanasi
          </Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jami savdo" value={formatMoney(totalUzs)} icon={ShoppingCart} />
        <StatCard
          label="Jami to'langan"
          value={formatMoney(paidUzs)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Jami qarz"
          value={formatMoney(debtUzs)}
          icon={Wallet}
          tone={debtUzs > 0 ? "warning" : "default"}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Bu davrda savdo yo&apos;q
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Hamkor</TableHead>
                  <TableHead>Valyuta</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="text-right">To&apos;langan</TableHead>
                  <TableHead className="text-right">Qoldiq</TableHead>
                  <TableHead>Holati</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.saleDate)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/savdo/hamkorlar/${s.partnerId}`} className="hover:underline">
                        {s.partner?.name ?? "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{s.currency}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.totalAmountUzs)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.paidAmountUzs)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(s.totalAmountUzs) - Number(s.paidAmountUzs))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.paymentStatus]}>
                        {paymentStatusLabels[s.paymentStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Bekor qilish"
                        onClick={() => setCancelTarget(s)}
                      >
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {active.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-2 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/savdo/hamkorlar/${s.partnerId}`}
                      className="font-medium hover:underline"
                    >
                      {s.partner?.name ?? "-"}
                    </Link>
                    <Badge variant={statusVariant[s.paymentStatus]}>
                      {paymentStatusLabels[s.paymentStatus]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{formatDate(s.saleDate)}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Summa / To&apos;langan</span>
                    <span>
                      {formatMoney(s.totalAmountUzs)} / {formatMoney(s.paidAmountUzs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1">
                    <p className="font-medium">
                      <span className="text-muted-foreground font-normal">Qoldiq: </span>
                      {formatMoney(Number(s.totalAmountUzs) - Number(s.paidAmountUzs))}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => setCancelTarget(s)}>
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Savdoni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{cancelTarget?.partner?.name}&quot; bilan savdoni bekor qilmoqchimisiz? Sotilgan
              mahsulotlar omborga qaytariladi. Yozuv o&apos;zi o&apos;chirilmaydi (Arxivda ko&apos;rinib
              turadi), lekin bu amalni ortga qaytarib bo&apos;lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo'q</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
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
