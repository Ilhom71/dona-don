"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpandableText } from "@/components/table-controls";
import { api } from "@/lib/api";
import type { CashLedgerRow, Partner } from "@/lib/types";
import {
  cashRowLabel,
  expenseCategoryLabels,
  formatDateTime,
  formatMoney,
  paymentMethodLabels,
} from "@/lib/format";

// Sahifadagi kartalarning har biri qaysi ma'lumot to'plamiga tegishli
// ekanini bildiradi - shu turga qarab modal ichida to'g'ri jadval chiziladi.
export type CashCardKind = "pot" | "myDebts" | "owedToMe" | "expenses" | "funding";

const CARD_TITLES: Record<CashCardKind, string> = {
  pot: "Qozondagi pul",
  myDebts: "Qarzlarim",
  owedToMe: "Menda qarzdorlar",
  expenses: "Xarajatlar",
  funding: "Olib turilgan pul",
};

// Backenddagi `cashRowKind` qoidasi bilan AYNAN bir xil: yetkazib beruvchiga
// to'lovdan boshqa barcha xarajatlar (ijara, ish haqi, transport...) qaytmas
// chiqim hisoblanadi - CLAUDE.md'dagi "Xarajatlar" kartasi shu qoidaga ko'ra hisoblanadi.
function isNonReturnableExpense(row: CashLedgerRow) {
  return row.source === "expense" && row.category !== "supplier_payment";
}

/**
 * Kassa amaliyotlari sahifasidagi 5 ta ko'rsatkich kartasidan (Qozondagi
 * pul, Qarzlarim, Menda qarzdorlar, Xarajatlar, Olib turilgan pul) biri
 * bosilganda ochiladigan tafsilot modali - kartadagi son AYNAN qaysi
 * yozuvlardan yig'ilganini jadval ko'rinishida ko'rsatadi (pastdagi "Jami"
 * qatori kartadagi qiymatga har doim teng bo'lishi kerak).
 */
export function CashCardDetailDialog({
  card,
  onClose,
  cardsTo,
  asOfHint,
  partners,
  partnersLoading,
}: {
  card: CashCardKind | null;
  onClose: () => void;
  // Kartalarning "holat sanasi" filtri ("" = hozirgi holat).
  cardsTo: string;
  asOfHint: string;
  // Sahifada allaqachon yuklangan "holat sanasi"ga mos hamkorlar ro'yxati
  // (qarz kartalari uchun) - qayta so'rov yuborilmaydi.
  partners: Partner[] | undefined;
  partnersLoading: boolean;
}) {
  const isLedgerCard = card === "pot" || card === "expenses" || card === "funding";

  // Faqat kassa yozuvlariga tegishli karta bosilganda va modal ochiq bo'lganda
  // yuklanadi - sahifa birinchi ochilganda ortiqcha so'rov yubormaslik uchun.
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["cash-ledger", "card-detail", cardsTo],
    queryFn: () => api.get<CashLedgerRow[]>(`/cash/ledger${cardsTo ? `?to=${cardsTo}` : ""}`),
    enabled: isLedgerCard,
  });

  // Kartaga mos yozuvlar - eng yangisi tepada. Bekor qilingan yozuvlar
  // hech qanday kartaning yig'indisiga kirmagani uchun bu yerda ham chiqarilmaydi.
  const rows = useMemo(() => {
    if (!ledger) return [];
    const active = ledger.filter((r) => !r.cancelled);
    const filtered =
      card === "expenses"
        ? active.filter(isNonReturnableExpense)
        : card === "funding"
          ? active.filter((r) => r.purpose === "funding")
          : active;
    return [...filtered].reverse();
  }, [ledger, card]);

  // Qarz kartalari uchun - manfiy balans "Qarzlarim" (biz qarzdormiz),
  // musbat balans "Menda qarzdorlar" (hamkor bizga qarzdor).
  const debtPartners = useMemo(() => {
    if (!partners) return [];
    if (card === "myDebts") {
      return partners.filter((p) => p.balanceUzs < 0).sort((a, b) => a.balanceUzs - b.balanceUzs);
    }
    if (card === "owedToMe") {
      return partners.filter((p) => p.balanceUzs > 0).sort((a, b) => b.balanceUzs - a.balanceUzs);
    }
    return [];
  }, [partners, card]);

  // Jadval ostidagi "Jami" - kartadagi qiymatga aniq teng bo'lishi shart,
  // shuning uchun kartaning o'zi bilan bir xil hisoblash qoidasi ishlatiladi.
  const total = useMemo(() => {
    if (card === "pot") {
      return rows.reduce((sum, r) => sum + (r.direction === "in" ? r.amountUzs : -r.amountUzs), 0);
    }
    if (card === "expenses") {
      return rows.reduce((sum, r) => sum + r.amountUzs, 0);
    }
    if (card === "funding") {
      return rows.reduce((sum, r) => sum + (r.direction === "in" ? r.amountUzs : -r.amountUzs), 0);
    }
    if (card === "myDebts") {
      return debtPartners.reduce((sum, p) => sum + Math.max(0, -p.balanceUzs), 0);
    }
    if (card === "owedToMe") {
      return debtPartners.reduce((sum, p) => sum + Math.max(0, p.balanceUzs), 0);
    }
    return 0;
  }, [card, rows, debtPartners]);

  const loading = isLedgerCard ? ledgerLoading : partnersLoading;
  const isEmpty = isLedgerCard ? rows.length === 0 : debtPartners.length === 0;

  return (
    <Dialog open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card ? CARD_TITLES[card] : ""}</DialogTitle>
          <DialogDescription>{asOfHint} - qaysi yozuvlardan kelib chiqqani</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Ma&apos;lumot yo&apos;q</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLedgerCard ? (
              <LedgerDetailTable rows={rows} card={card} total={total} />
            ) : (
              <PartnerDetailTable partners={debtPartners} total={total} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Qozondagi pul / Xarajatlar / Olib turilgan pul - kassa yozuvlari jadvali. */
function LedgerDetailTable({
  rows,
  card,
  total,
}: {
  rows: CashLedgerRow[];
  card: "pot" | "expenses" | "funding";
  total: number;
}) {
  return (
    <>
      {/* Desktop: to'liq jadval */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Sana</TableHead>
            <TableHead>Turi</TableHead>
            {card === "pot" && <TableHead>Hamkor</TableHead>}
            <TableHead>Usuli</TableHead>
            <TableHead>Tavsif</TableHead>
            <TableHead className="text-right">Summa</TableHead>
            {card === "pot" && <TableHead className="text-right">Qoldiq</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDateTime(r.date)}</TableCell>
              <TableCell>
                <Badge variant={r.direction === "in" ? "default" : "destructive"}>
                  {card === "expenses" ? expenseCategoryLabels[r.category as keyof typeof expenseCategoryLabels] ?? r.category : cashRowLabel(r)}
                </Badge>
              </TableCell>
              {card === "pot" && <TableCell>{r.partnerName ?? "-"}</TableCell>}
              <TableCell>{paymentMethodLabels[r.method] ?? r.method}</TableCell>
              <TableCell className="max-w-64">
                <ExpandableText text={r.description} />
              </TableCell>
              <TableCell
                className={`text-right font-medium tabular-nums ${
                  r.direction === "in" ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {r.direction === "in" ? "+" : "-"}
                {formatMoney(r.amountUzs)}
              </TableCell>
              {card === "pot" && (
                <TableCell className="text-right tabular-nums">{formatMoney(r.balanceUzs)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={card === "pot" ? 5 : 4}>Jami ({rows.length} ta)</TableCell>
            <TableCell
              className={`text-right tabular-nums ${total >= 0 ? "text-emerald-600" : "text-destructive"}`}
            >
              {formatMoney(total)}
            </TableCell>
            {card === "pot" && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      {/* Mobil: kartochka ro'yxati */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={r.direction === "in" ? "default" : "destructive"}>
                {card === "expenses" ? expenseCategoryLabels[r.category as keyof typeof expenseCategoryLabels] ?? r.category : cashRowLabel(r)}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDateTime(r.date)}</span>
            </div>
            <ExpandableText text={r.description} />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="truncate">
                {card === "pot" ? r.partnerName ?? "-" : paymentMethodLabels[r.method] ?? r.method}
              </span>
              <span
                className={`shrink-0 tabular-nums ${r.direction === "in" ? "text-emerald-600" : "text-destructive"}`}
              >
                {r.direction === "in" ? "+" : "-"}
                {formatMoney(r.amountUzs)}
              </span>
            </div>
            {card === "pot" && (
              <div className="flex items-center justify-between border-t pt-1">
                <span className="text-xs text-muted-foreground">Qoldiq</span>
                <span className="tabular-nums">{formatMoney(r.balanceUzs)}</span>
              </div>
            )}
          </div>
        ))}
        <div className="rounded-md border bg-muted p-3 text-sm font-semibold">
          <p className="flex justify-between">
            <span>Jami ({rows.length} ta)</span>
            <span className={`tabular-nums ${total >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatMoney(total)}
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

/** Qarzlarim / Menda qarzdorlar - hamkorlar bo'yicha qarz jadvali. */
function PartnerDetailTable({ partners, total }: { partners: Partner[]; total: number }) {
  return (
    <>
      {/* Desktop: to'liq jadval */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Hamkor</TableHead>
            <TableHead className="text-right">Qarz summasi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/savdo/hamkorlar/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(Math.abs(p.balanceUzs))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Jami ({partners.length} ta)</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {/* Mobil: kartochka ro'yxati */}
      <div className="space-y-2 md:hidden">
        {partners.map((p) => (
          <Link
            key={p.id}
            href={`/savdo/hamkorlar/${p.id}`}
            className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
          >
            <span className="truncate font-medium">{p.name}</span>
            <span className="shrink-0 tabular-nums">{formatMoney(Math.abs(p.balanceUzs))}</span>
          </Link>
        ))}
        <div className="rounded-md border bg-muted p-3 text-sm font-semibold">
          <p className="flex justify-between">
            <span>Jami ({partners.length} ta)</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </p>
        </div>
      </div>
    </>
  );
}
