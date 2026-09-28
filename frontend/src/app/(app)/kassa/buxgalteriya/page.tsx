"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Ban,
  Building2,
  DollarSign,
  Landmark,
  MinusCircle,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
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
import { AccountingTransactionFormDialog } from "@/components/accounting-transaction-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { AccountingReport, CashLedgerRow, CashSummary, DashboardSummary } from "@/lib/types";
import {
  cashDirectionLabels,
  expenseCategoryLabels,
  formatDateTime,
  formatMoney,
} from "@/lib/format";

type RateHistoryItem = { id: string; rate: string; createdAt: string };

/**
 * Buxgalteriya - firmaning joriy hisobi (rasmiy hisob-kitob). Kassa faqat
 * kunlik naqd savdo aylanmasi bo'lsa, bu yerga kassadan pul o'tkaziladi va
 * shu yerdan rasmiy chiqim (pul chiqarish) qilinadi. Qoldiq har doim
 * `cash_transactions` jadvalidagi "buxgalteriya" hisobiga tegishli
 * yozuvlardan **dinamik** hisoblanadi (qattiq kodlangan qiymat emas).
 */
export default function AccountingPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [bankTransferOpen, setBankTransferOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CashLedgerRow | null>(null);
  const [newRate, setNewRate] = useState("");

  const cancelMutation = useMutation({
    mutationFn: (row: CashLedgerRow) => api.post(`/cash/transactions/${row.id}/cancel`, {}),
    onSuccess: () => {
      toast.success("Bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      // Bekor qilingan yozuv kassa->buxgalteriya o'tkazmaning bir tomoni
      // bo'lishi mumkin - bunda kassa tomoni ham serverda avtomatik bekor
      // qilinadi, shuning uchun Kassa sahifalarini ham yangilaymiz.
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setCancelTarget(null),
  });

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  // "to" kunining oxirigacha (23:59:59) qo'shiladi, aks holda o'sha kundagi
  // yozuvlar chetda qolib ketadi (backend `to` ni kun boshi - 00:00 sifatida oladi).
  if (to) params.set("to", `${to}T23:59:59`);
  const qs = params.toString();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["accounting-summary", from, to],
    queryFn: () => api.get<CashSummary>(`/cash/accounting/summary${qs ? `?${qs}` : ""}`),
  });

  // "Ombordagi qoldiq qiymati" - umumiy biznes ko'rsatkichi, Kassa "faqat
  // kunlik savdo"ga qisqartirilgach, unga eng mos joy shu - firmaning
  // moliyaviy holati (Buxgalteriya) qismi.
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/reports/dashboard"),
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["accounting-ledger", from, to],
    queryFn: () => api.get<CashLedgerRow[]>(`/cash/accounting/ledger${qs ? `?${qs}` : ""}`),
  });
  // Bekor qilingan yozuvlar bu ro'yxatda ko'rinmaydi - ular Arxiv bo'limining
  // "Bekor qilingan buxgalteriya amaliyotlari" qismida ko'rinadi.
  const visibleLedger = (ledger ?? []).filter((r) => !r.cancelled);

  // Foyda-zarar hisoboti va USD/UZS kursi - bu yerda, chunki "rasmiy hisob"ga
  // tegishli (Kassa endi faqat kunlik naqd savdo, bu kengroq hisobotlar emas).
  const { data: accounting, isLoading: accountingLoading } = useQuery({
    queryKey: ["accounting-report", from, to],
    queryFn: () => api.get<AccountingReport>(`/reports/accounting${qs ? `?${qs}` : ""}`),
  });

  const { data: rate, isLoading: rateLoading } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => api.get<{ rate: number | null }>("/settings/exchange-rate"),
  });
  const { data: rateHistory } = useQuery({
    queryKey: ["exchange-rate-history"],
    queryFn: () => api.get<RateHistoryItem[]>("/settings/exchange-rate/history"),
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => api.post("/settings/exchange-rate", { rate: value }),
    onSuccess: () => {
      toast.success("Valyuta kursi yangilandi");
      setNewRate("");
      queryClient.invalidateQueries({ queryKey: ["exchange-rate"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-history"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div>
        <h1 className="text-2xl font-semibold">Buxgalteriya</h1>
        <p className="text-sm text-muted-foreground">
          Firmaning joriy hisobi - kassadan o&apos;tkazilgan va rasmiy chiqim qilingan mablag&apos;
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="h-4 w-4" />
          Kassadan o&apos;tkazish
        </Button>
        <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
          <MinusCircle className="h-4 w-4" />
          Pul chiqarish
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBankTransferOpen(true)}>
          <Building2 className="h-4 w-4" />
          Bank orqali pul o&apos;tkazish
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Joriy hisob qoldig&apos;i
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-semibold">{formatMoney(summary?.currentBalanceUzs ?? 0)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Davr bo&apos;yicha kirim
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-semibold text-emerald-600">
                {formatMoney(summary?.periodInUzs ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Davr bo&apos;yicha chiqim
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-semibold text-destructive">
                {formatMoney(summary?.periodOutUzs ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ombordagi qoldiq qiymati
            </CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading || !dashboard ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-xl font-semibold">{formatMoney(dashboard.stockValueUzs)}</p>
            )}
          </CardContent>
        </Card>
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

      {ledgerLoading ? (
        <Skeleton className="h-64" />
      ) : visibleLedger.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Bu davrda buxgalteriya harakati yo&apos;q</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Yo&apos;nalish</TableHead>
                  <TableHead>Tavsif</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="text-right">Qoldiq</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...visibleLedger].reverse().map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateTime(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={r.direction === "in" ? "default" : "destructive"}>
                        {cashDirectionLabels[r.direction]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-96 truncate">
                      {r.description}
                      {r.bankAccount && (
                        <span className="ml-2 text-xs text-muted-foreground">({r.bankAccount})</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        r.direction === "in" ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {r.direction === "in" ? "+" : "-"}
                      {formatMoney(r.amountUzs)}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(r.balanceUzs)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Bekor qilish"
                        onClick={() => setCancelTarget(r)}
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
            {[...visibleLedger].reverse().map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <Badge variant={r.direction === "in" ? "default" : "destructive"}>
                      {cashDirectionLabels[r.direction]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.date)}</span>
                  </div>
                  <p>
                    {r.description}
                    {r.bankAccount && (
                      <span className="ml-1 text-xs text-muted-foreground">({r.bankAccount})</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between border-t pt-1">
                    <p className="font-medium">
                      <span className="text-muted-foreground font-normal">Qoldiq: </span>
                      {formatMoney(r.balanceUzs)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={r.direction === "in" ? "text-emerald-600" : "text-destructive"}
                      >
                        {r.direction === "in" ? "+" : "-"}
                        {formatMoney(r.amountUzs)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => setCancelTarget(r)}>
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Foyda-zarar hisoboti - yuqoridagi sana oralig'i (from/to) bo'yicha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Foyda-zarar (tanlangan davr)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountingLoading || !accounting ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <p className="text-xs text-muted-foreground">Daromad (savdo)</p>
                  <p className="font-medium">{formatMoney(accounting.revenueUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tannarx</p>
                  <p className="font-medium">{formatMoney(accounting.cogsUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Yalpi foyda</p>
                  <p className="font-medium">{formatMoney(accounting.grossProfitUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Xarajatlar</p>
                  <p className="font-medium">{formatMoney(accounting.expensesUzs)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sof foyda</p>
                  <p
                    className={`font-semibold flex items-center gap-1 ${
                      accounting.netProfitUzs >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {accounting.netProfitUzs >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {formatMoney(accounting.netProfitUzs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Qarzdorlik (hozirgi)</p>
                  <p className="font-medium">{formatMoney(accounting.receivablesUzs)}</p>
                </div>
              </div>

              {accounting.expensesByCategory.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Xarajatlar kategoriya bo&apos;yicha
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {accounting.expensesByCategory.map((e) => (
                      <Badge key={e.category} variant="outline">
                        {expenseCategoryLabels[e.category as keyof typeof expenseCategoryLabels] ??
                          e.category}
                        : {formatMoney(e.totalUzs)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* USD/UZS kursi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            USD / UZS kursi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rateLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <p className="text-2xl font-semibold">
              {rate?.rate ? formatMoney(rate.rate) : "Kiritilmagan"}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newRate) rateMutation.mutate(Number(newRate));
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="space-y-2">
              <Label htmlFor="rate">Yangi kurs (1 USD = ? so&apos;m)</Label>
              <MoneyInput
                id="rate"
                allowDecimal
                value={newRate}
                onChange={setNewRate}
                placeholder="12 700"
              />
            </div>
            <Button type="submit" disabled={rateMutation.isPending || !newRate}>
              {rateMutation.isPending ? "Saqlanmoqda..." : "Yangilash"}
            </Button>
          </form>
          {!!rateHistory?.length && (
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">Kurs tarixi</p>
              {rateHistory.slice(0, 5).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{formatMoney(h.rate)}</span>
                  <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AccountingTransactionFormDialog
        mode="transfer"
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
      <AccountingTransactionFormDialog
        mode="withdraw"
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
      />
      <AccountingTransactionFormDialog
        mode="withdraw"
        defaultMethod="bank"
        open={bankTransferOpen}
        onOpenChange={setBankTransferOpen}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yozuvni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{cancelTarget?.description}&quot; ({formatMoney(cancelTarget?.amountUzs ?? 0)})
              yozuvini bekor qilmoqchimisiz? Buxgalteriya qoldig&apos;idan chiqarib tashlanadi, lekin
              o&apos;chirilmaydi - Arxiv bo&apos;limidan &quot;Tiklash&quot; bilan qaytarish mumkin.
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
