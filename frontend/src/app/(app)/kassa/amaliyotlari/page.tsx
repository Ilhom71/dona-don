"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  CircleDollarSign,
  Landmark,
  MinusCircle,
  PlusCircle,
  Receipt,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ExcelActions } from "@/components/excel-actions";
import { KassaSubNav } from "@/components/kassa-subnav";
import { CashTransactionFormDialog } from "@/components/cash-transaction-form-dialog";
import { ExpenseFormDialog } from "@/components/expense-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { CashLedgerRow, CashSummary, Partner } from "@/lib/types";
import { cashDirectionLabels, formatDateTime, formatMoney, paymentMethodLabels } from "@/lib/format";

// Kelib chiqqan jadvaliga qarab to'g'ri "bekor qilish" endpointini tanlaydi.
function cancelPathFor(row: CashLedgerRow) {
  if (row.source === "payment") return `/payments/${row.id}/cancel`;
  if (row.source === "expense") return `/expenses/${row.id}/cancel`;
  return `/cash/transactions/${row.id}/cancel`;
}

/**
 * Kassa amaliyotlari - to'liq kassa harakati (mijozdan to'lov + xarajat +
 * qo'lda kirim/chiqim), Kassa bo'limining o'z alohida sahifasi.
 */
export default function CashOperationsPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CashLedgerRow | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (row: CashLedgerRow) => api.post(cancelPathFor(row), {}),
    onSuccess: () => {
      toast.success("Bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      // Bekor qilingan yozuv kassa->buxgalteriya o'tkazmaning bir tomoni
      // bo'lishi mumkin - bunda ikkinchi tomon (buxgalteriya) ham serverda
      // avtomatik bekor qilinadi, shuning uchun u yerni ham yangilaymiz.
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-report"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
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
    queryKey: ["cash-summary", from, to],
    queryFn: () => api.get<CashSummary>(`/cash/summary${qs ? `?${qs}` : ""}`),
  });

  // "Qozondagi pul" (kassa+buxgalteriya), "Qarzlarim" va "Asosiy o'zim
  // pulim" kartalari uchun - davrga bog'liq emas, har doim hozirgi holat.
  const { data: accountingSummary, isLoading: accountingLoading } = useQuery({
    queryKey: ["accounting-summary", "all"],
    queryFn: () => api.get<CashSummary>("/cash/accounting/summary"),
  });
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const potMoneyUzs = (summary?.currentBalanceUzs ?? 0) + (accountingSummary?.currentBalanceUzs ?? 0);
  // Faqat manfiy balanslar (biz hamkorga qarzdor bo'lganlar) - musbatlari
  // "mijoz bizga qarzdor", bu "mening qarzim" emas.
  const myDebtsUzs = (partners ?? []).reduce(
    (sum, p) => sum + Math.max(0, -p.balanceUzs),
    0
  );
  const netOwnMoneyUzs = potMoneyUzs - myDebtsUzs;
  const potLoading = summaryLoading || accountingLoading;
  const debtsLoading = partnersLoading;

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["cash-ledger", from, to],
    queryFn: () => api.get<CashLedgerRow[]>(`/cash/ledger${qs ? `?${qs}` : ""}`),
  });
  // Bekor qilingan yozuvlar bu ro'yxatda ko'rinmaydi - ular faqat Arxiv
  // bo'limining "Bekor qilingan kassa amaliyotlari" qismida ko'rinadi.
  const visibleLedger = (ledger ?? []).filter((r) => !r.cancelled);

  return (
    <div className="space-y-4">
      <KassaSubNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kassa amaliyotlari</h1>
          <p className="text-sm text-muted-foreground">
            Mijozdan to&apos;lov, xarajat va qo&apos;lda kirim/chiqim - to&apos;liq kassa harakati
          </p>
        </div>
        <ExcelActions
          exportPath="/excel/cash/export"
          exportFileName="kassa.xlsx"
          importPath="/excel/expenses/import"
          templatePath="/excel/expenses/template"
          invalidateKey={["cash-ledger", "cash-summary"]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setCashInOpen(true)}>
          <PlusCircle className="h-4 w-4" />
          Kirim qo&apos;shish
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCashOutOpen(true)}>
          <MinusCircle className="h-4 w-4" />
          Chiqim (naqd)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}>
          <Receipt className="h-4 w-4" />
          Xarajat qo&apos;shish
        </Button>
      </div>

      {/* Foydalanuvchi so'roviga ko'ra: umumiy moliyaviy holat - davrga
          bog'liq bo'lmagan, har doim hozirgi holat. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Qozondagi pul
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {potLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-xl font-semibold">{formatMoney(potMoneyUzs)}</p>
                <p className="text-xs text-muted-foreground">Kassa + Buxgalteriya</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qarzlarim</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {debtsLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p className="text-xl font-semibold text-destructive">{formatMoney(myDebtsUzs)}</p>
                <p className="text-xs text-muted-foreground">Hamkorlarga qarzdor summa</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Asosiy o&apos;zim pulim
            </CardTitle>
            <Landmark className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {potLoading || debtsLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <>
                <p
                  className={`text-xl font-semibold ${netOwnMoneyUzs >= 0 ? "" : "text-destructive"}`}
                >
                  {formatMoney(netOwnMoneyUzs)}
                </p>
                <p className="text-xs text-muted-foreground">Qozondagi pul − Qarzlarim</p>
              </>
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
            <Wallet className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Bu davrda kassa harakati yo&apos;q</p>
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
                  <TableHead>Hamkor</TableHead>
                  <TableHead>Usuli</TableHead>
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
                    <TableCell className="max-w-72 truncate">{r.description}</TableCell>
                    <TableCell>{r.partnerName ?? "-"}</TableCell>
                    <TableCell>
                      {paymentMethodLabels[r.method] ?? r.method}
                      {r.bankAccount && (
                        <p className="text-xs text-muted-foreground">{r.bankAccount}</p>
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
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(r.date)}
                    </span>
                  </div>
                  <p>{r.description}</p>
                  {r.bankAccount && (
                    <p className="text-xs text-muted-foreground">
                      {paymentMethodLabels[r.method] ?? r.method}: {r.bankAccount}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{r.partnerName ?? "-"}</span>
                    <span
                      className={r.direction === "in" ? "text-emerald-600" : "text-destructive"}
                    >
                      {r.direction === "in" ? "+" : "-"}
                      {formatMoney(r.amountUzs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1">
                    <p className="font-medium">
                      <span className="text-muted-foreground font-normal">Qoldiq: </span>
                      {formatMoney(r.balanceUzs)}
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => setCancelTarget(r)}>
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CashTransactionFormDialog direction="in" open={cashInOpen} onOpenChange={setCashInOpen} />
      <CashTransactionFormDialog direction="out" open={cashOutOpen} onOpenChange={setCashOutOpen} />
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Yozuvni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{cancelTarget?.description}&quot; ({formatMoney(cancelTarget?.amountUzs ?? 0)})
              yozuvini bekor qilmoqchimisiz? Kassa qoldig&apos;idan chiqarib tashlanadi, lekin
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
