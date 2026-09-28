"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, DollarSign, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CashLedgerRow, Product } from "@/lib/types";
import { cashRowLabel, formatDateTime, formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";

type RateHistoryItem = { id: string; rate: string; createdAt: string };

/** USD kursi: kichik karta, kurs tarixi va yangilash ochiladigan qismda. */
export function RateCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newRate, setNewRate] = useState("");

  const { data: rate, isLoading } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => api.get<{ rate: number | null }>("/settings/exchange-rate"),
  });
  const { data: history } = useQuery({
    queryKey: ["exchange-rate-history"],
    enabled: open,
    queryFn: () => api.get<RateHistoryItem[]>("/settings/exchange-rate/history"),
  });

  const mutation = useMutation({
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
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Dollar kursi
        </CardTitle>
        {isLoading ? (
          <Skeleton className="h-6 w-28" />
        ) : (
          <p className="text-lg font-semibold tabular-nums">
            {rate?.rate ? formatMoney(rate.rate) : "Kiritilmagan"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Kursni o&apos;zgartirish va tarix
          <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
        {open && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newRate) mutation.mutate(Number(newRate));
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="space-y-2">
                <Label htmlFor="rate">Yangi kurs (1 dollar = ? so&apos;m)</Label>
                <MoneyInput id="rate" allowDecimal value={newRate} onChange={setNewRate} placeholder="12 700" />
              </div>
              <Button type="submit" disabled={mutation.isPending || !newRate}>
                {mutation.isPending ? "Saqlanmoqda..." : "Yangilash"}
              </Button>
            </form>
            {!!history?.length && (
              <div className="space-y-1 border-t pt-3">
                <p className="text-xs text-muted-foreground">Kurs tarixi</p>
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span>{formatMoney(h.rate)}</span>
                    <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Kam qolgan mahsulotlar (bo'sh bo'lsa umuman ko'rsatilmaydi). */
export function LowStockCard({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <TriangleAlert className="h-4 w-4 text-amber-600" />
          Omborda kam qolgan mahsulotlar
        </CardTitle>
        <Link href="/ombor/mahsulotlar" className="flex items-center gap-1 text-sm text-primary hover:underline">
          Barchasi <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <span className="truncate font-medium">{p.name}</span>
            <Badge variant="destructive">{formatQuantity(p.stockQuantity, p.unit)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** So'nggi 6 ta kassa harakati, yo'nalish yorlig'i bilan. */
export function RecentMovements() {
  const { data: ledger, isLoading } = useQuery({
    queryKey: ["cash-ledger", "", ""],
    queryFn: () => api.get<CashLedgerRow[]>("/cash/ledger"),
  });
  const rows = [...(ledger ?? [])].filter((r) => !r.cancelled).reverse().slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">So&apos;nggi pul harakatlari</CardTitle>
        <Link
          href="/kassa/amaliyotlari"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Hammasi <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Hozircha pul harakati yo&apos;q</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {cashRowLabel(r)} · {formatDateTime(r.date)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  r.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                )}
                title={formatMoney(r.amountUzs)}
              >
                {r.direction === "in" ? "+" : "-"}
                {formatMoneyCompact(r.amountUzs)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
