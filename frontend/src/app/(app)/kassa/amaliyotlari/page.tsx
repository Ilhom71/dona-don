"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  CircleDollarSign,
  HandCoins,
  ListFilter,
  MinusCircle,
  PiggyBank,
  PlusCircle,
  Receipt,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";
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
  TableFooter,
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
import { FundingFormDialog } from "@/components/funding-form-dialog";
import { CashCardDetailDialog, type CashCardKind } from "@/components/cash-card-detail-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExpandableText,
  MobileSortSelect,
  SortableHead,
  TableExportButton,
  TablePagination,
  TableSearch,
} from "@/components/table-controls";
import { useTableView } from "@/hooks/use-table-view";
import { api, ApiError } from "@/lib/api";
import type { CashLedgerRow, CashSummary, Partner } from "@/lib/types";
import {
  cashRowLabel,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  paymentMethodLabels,
  toDateInputValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// "Yo'nalish" filtri: Chiqim va Qaytmas chiqim alohida ajratiladi (cashRowLabel bilan bir xil qoida).
const directionFilterItems = [
  { value: "all", label: "Hammasi" },
  { value: "in", label: "Kirim" },
  { value: "out", label: "Chiqim" },
  { value: "non_returnable", label: "Qaytmas chiqim" },
];

// To'lov usuli filtri
const methodFilterItems = [
  { value: "all", label: "Barcha usullar" },
  ...Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label })),
];

// Tezkor sana tugmalari: har biri (from, to) juftligini qaytaradi ("" = cheklovsiz).
type QuickRange = "today" | "week" | "month" | "all";
const quickRanges: { key: QuickRange; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "Hafta" },
  { key: "month", label: "Oy" },
  { key: "all", label: "Hammasi" },
];

function rangeFor(key: QuickRange): { from: string; to: string } {
  const now = new Date();
  const today = toDateInputValue(now);
  if (key === "today") return { from: today, to: today };
  if (key === "week") {
    // Oxirgi 7 kun (bugun bilan birga)
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: toDateInputValue(start), to: today };
  }
  if (key === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateInputValue(start), to: today };
  }
  return { from: "", to: "" };
}

// Kartalar ("Qozondagi pul", "Qarzlarim" va h.k.) - bular kumulyativ
// (qoldiq/qarz) qiymatlar, davr emas, balki BITTA "holat sanasi"ga ko'ra
// ko'rinadi. Har bir tezkor tugma boshqa-boshqa sanani beradi, shuning
// uchun har biri kartalarda ANIQ ko'rinadigan natija beradi.
type CardsQuick = "today" | "yesterday" | "weekAgo" | "monthStart";
const cardsQuickOptions: { key: CardsQuick; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "weekAgo", label: "Hafta oldin" },
  { key: "monthStart", label: "Oy boshi" },
];

function cardsDateFor(key: CardsQuick): string {
  const now = new Date();
  if (key === "today") return toDateInputValue(now);
  if (key === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toDateInputValue(d);
  }
  if (key === "weekAgo") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return toDateInputValue(d);
  }
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function directionKind(row: CashLedgerRow) {
  if (row.direction === "in") return "in";
  return cashRowLabel(row) === "Qaytmas chiqim" ? "non_returnable" : "out";
}

// "Pul olib turish" / "Pulni qaytarish" - odatiy kirim/chiqimdan ajratish uchun
// alohida (neytral) belgi rangi, hamkor qarzi/foyda bilan aralashtirilmasin.
function badgeVariantFor(row: CashLedgerRow) {
  if (row.purpose === "funding") return "outline" as const;
  return row.direction === "in" ? ("default" as const) : ("destructive" as const);
}

// Kelib chiqqan jadvaliga qarab to'g'ri "bekor qilish" endpointini tanlaydi.
function cancelPathFor(row: CashLedgerRow) {
  if (row.source === "payment") return `/payments/${row.id}/cancel`;
  if (row.source === "expense") return `/expenses/${row.id}/cancel`;
  return `/cash/transactions/${row.id}/cancel`;
}

// Ixcham ko'rsatkich katagi: qisqa son (mln/mlrd), to'liq qiymat hover'da.
// `onClick` berilsa - karta bosiladigan bo'ladi (sichqoncha va klaviatura
// bilan ham) va bosilganda tafsilot modalini ochadi.
function SummaryTile({
  label,
  hint,
  icon,
  value,
  loading,
  valueClassName,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: number;
  loading: boolean;
  valueClassName?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      size="sm"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        onClick &&
          "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <CardContent className="space-y-0.5 px-3 py-2">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <p
            className={cn("truncate text-lg font-semibold tabular-nums", valueClassName)}
            title={formatMoney(value)}
          >
            {formatMoneyCompact(value)}
          </p>
        )}
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Kassa amaliyotlari - to'liq kassa harakati (mijozdan to'lov + xarajat +
 * qo'lda kirim/chiqim), Kassa bo'limining o'z alohida sahifasi.
 */
export default function CashOperationsPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Kartalar (Qozondagi pul, Qarzlarim, ...) uchun ALOHIDA "holat sanasi" -
  // pastdagi kassa lentasi filtridan mustaqil, faqat shu bitta sanaga ko'ra
  // kumulyativ qoldiq/qarzni ko'rsatadi ("" = hozirgi holat).
  const [cardsTo, setCardsTo] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  // Mobilda filtrlar paneli yig'iladi (desktopda doim ochiq).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [fundingInOpen, setFundingInOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CashLedgerRow | null>(null);
  // Qaysi ko'rsatkich kartasi bosilib, tafsilot modali ochilganini saqlaydi (null = yopiq).
  const [openCard, setOpenCard] = useState<CashCardKind | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (row: CashLedgerRow) => api.post(cancelPathFor(row), {}),
    onSuccess: () => {
      toast.success("Bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-report"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setCancelTarget(null),
  });

  const params = new URLSearchParams();
  // Backend sanalarni Toshkent vaqti bo'yicha o'qiydi va faqat sana kelganda
  // `to` kun oxirigacha kiradi - shuning uchun YYYY-MM-DD ning o'zi yuboriladi.
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (partnerFilter !== "all") params.set("partnerId", partnerFilter);
  if (methodFilter !== "all") params.set("method", methodFilter);
  if (directionFilter !== "all") params.set("kind", directionFilter);
  const qs = params.toString();

  const activeFilterCount =
    (from || to ? 1 : 0) +
    (directionFilter !== "all" ? 1 : 0) +
    (partnerFilter !== "all" ? 1 : 0) +
    (methodFilter !== "all" ? 1 : 0);
  const activeQuick = quickRanges.find((q) => {
    const rg = rangeFor(q.key);
    return rg.from === from && rg.to === to;
  })?.key;

  function clearFilters() {
    setFrom("");
    setTo("");
    setDirectionFilter("all");
    setPartnerFilter("all");
    setMethodFilter("all");
  }

  // "Qozondagi pul", "Qarzlarim", "Menda qarzdorlar", "Xarajatlar" va "Olib
  // turilgan pul" kartalari - o'zining ALOHIDA sana filtriga (`cardsTo`)
  // ko'ra: tanlansa, o'sha sanadagi (kun oxiridagi) holat ko'rsatiladi
  // ("o'sha kuni qancha pul/qarz bo'lgan"); tanlanmasa - hozirgi holat.
  const { data: summary, isLoading: potLoading } = useQuery({
    queryKey: ["cash-summary", cardsTo],
    queryFn: () => api.get<CashSummary>(`/cash/summary${cardsTo ? `?to=${cardsTo}` : ""}`),
  });
  const { data: cardsPartners, isLoading: debtsLoading } = useQuery({
    queryKey: ["partners", "cards", cardsTo],
    queryFn: () => api.get<Partner[]>(`/partners${cardsTo ? `?asOf=${cardsTo}` : ""}`),
  });
  const potMoneyUzs = summary?.currentBalanceUzs ?? 0;
  // Manfiy balanslar - biz hamkorga qarzdormiz ("Qarzlarim"); musbatlari -
  // hamkor bizga qarzdor ("Menda qarzdorlar").
  const myDebtsUzs = (cardsPartners ?? []).reduce((sum, p) => sum + Math.max(0, -p.balanceUzs), 0);
  const owedToMeUzs = (cardsPartners ?? []).reduce((sum, p) => sum + Math.max(0, p.balanceUzs), 0);
  // Xarajatlar (qaytmas chiqim) alohida kartada ko'rsatiladi.
  const totalExpensesUzs = summary?.totalExpensesUzs ?? 0;
  // Hali qaytarilmagan "Pul olib turish" summasi - `cardsTo` bo'yicha ham
  // o'zgaradi (backend "asOf" cutoff bilan hisoblaydi).
  const fundingBalanceUzs = summary?.fundingBalanceUzs ?? 0;
  // Kartalar tepasida qaysi holatga ko'ra ekanini ko'rsatuvchi qisqa izoh.
  const asOfHint = cardsTo ? `${cardsTo} holatiga ko'ra` : "Hozirgi holat";
  const cardsActiveQuick = cardsQuickOptions.find((q) => cardsDateFor(q.key) === cardsTo)?.key;

  // Hamkor filtri (pastdagi kassa lentasi uchun) - har doim to'liq (bugungi)
  // hamkorlar ro'yxati, kartalar sana filtridan mustaqil.
  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["cash-ledger", from, to, partnerFilter, methodFilter, directionFilter],
    queryFn: () => api.get<CashLedgerRow[]>(`/cash/ledger${qs ? `?${qs}` : ""}`),
  });
  // Bekor qilingan yozuvlar bu ro'yxatda ko'rinmaydi - ular faqat Arxiv
  // bo'limining "Bekor qilingan kassa amaliyotlari" qismida ko'rinadi.
  // Eng yangisi tepada.
  const visibleLedger = useMemo(
    () =>
      [...(ledger ?? [])]
        .filter((r) => !r.cancelled)
        // Yo'nalish filtri backend `kind` orqali qo'llanadi; bu yerda ham bir xil qoida
        // (directionKind) bilan tekshiriladi - natija har doim jadval yorlig'iga mos bo'lishi uchun.
        .filter((r) => directionFilter === "all" || directionKind(r) === directionFilter)
        .reverse(),
    [ledger, directionFilter]
  );
  const partnerFilterItems = useMemo(
    () => [
      { value: "all", label: "Barcha hamkorlar" },
      ...(partners ?? []).map((p) => ({ value: p.id, label: p.name })),
    ],
    [partners]
  );
  const view = useTableView(
    visibleLedger,
    (r) =>
      `${r.description} ${r.partnerName ?? ""} ${paymentMethodLabels[r.method] ?? r.method} ${cashRowLabel(r)} ${r.bankAccount ?? ""}`,
    20,
    // Saralanadigan ustunlar: sana, hamkor, summa, qoldiq
    {
      date: (r) => Date.parse(r.date),
      partner: (r) => r.partnerName,
      amount: (r) => r.amountUzs,
      balance: (r) => r.balanceUzs,
    }
  );
  // Jadval ostidagi jami - qidiruvdan o'tgan barcha qatorlar bo'yicha.
  const totalIn = view.filtered.filter((r) => r.direction === "in").reduce((sum, r) => sum + r.amountUzs, 0);
  const totalOut = view.filtered.filter((r) => r.direction === "out").reduce((sum, r) => sum + r.amountUzs, 0);

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
          importPath="/excel/cash/import"
          templatePath="/excel/cash/template"
          invalidateKey={["cash-ledger", "cash-summary", "partners"]}
          importWarning="Faqat yangi yozuvlarni yuklang - bazada bor yozuvlar takrorlanadi"
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
          Qaytmas chiqim (xarajat)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setFundingInOpen(true)}>
          <PiggyBank className="h-4 w-4" />
          Pul olib turish
        </Button>
      </div>

      {/* Kartalarning O'ZINING sana filtri - pastdagi kassa lentasi filtridan
          mustaqil. Bu kumulyativ (qoldiq/qarz) qiymatlar bo'lgani uchun davr
          emas, balki BITTA "holat sanasi" (cardsTo) tanlanadi - shu sanadagi
          (kun oxiridagi) qoldiq/qarzni ko'rsatadi. Har bir tezkor tugma
          boshqa sanani beradi, shuning uchun bosilganda karta qiymati
          har doim sezilarli o'zgaradi. */}
      <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Kartalar qaysi sanaga ko&apos;ra</Label>
          <div className="flex flex-wrap gap-1.5">
            {cardsQuickOptions.map((q) => (
              <Button
                key={q.key}
                size="sm"
                variant={cardsActiveQuick === q.key ? "default" : "outline"}
                onClick={() => setCardsTo(cardsDateFor(q.key))}
              >
                {q.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="cardsTo" className="text-xs text-muted-foreground">
              Holat sanasi
            </Label>
            <Input id="cardsTo" type="date" value={cardsTo} onChange={(e) => setCardsTo(e.target.value)} />
          </div>
          {cardsTo && (
            <Button size="sm" variant="ghost" onClick={() => setCardsTo("")}>
              <X className="h-4 w-4" />
              Hozirgi holat
            </Button>
          )}
        </div>
      </div>

      {/* Umumiy moliyaviy holat - ixcham qator: 2x3 mobilda, 5 ustun desktopda.
          Qisqa son ko'rinadi, to'liq qiymat hover (title) da. Yuqoridagi
          "Holat sanasi" (`cardsTo`) filtri tanlansa, kartalar o'sha sanadagi
          holatni ko'rsatadi (asOfHint har biriga qo'shiladi). */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <SummaryTile
          label="Qozondagi pul"
          hint={`Kassadagi pul - ${asOfHint}`}
          icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
          value={potMoneyUzs}
          loading={potLoading}
          onClick={() => setOpenCard("pot")}
        />
        <SummaryTile
          label="Qarzlarim"
          hint={`Men hamkorlarga qarzdorman - ${asOfHint}`}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          value={myDebtsUzs}
          loading={debtsLoading}
          valueClassName="text-destructive"
          onClick={() => setOpenCard("myDebts")}
        />
        <SummaryTile
          label="Menda qarzdorlar"
          hint={`Hamkorlar menga qarzdor - ${asOfHint}`}
          icon={<HandCoins className="h-4 w-4 text-emerald-600" />}
          value={owedToMeUzs}
          loading={debtsLoading}
          valueClassName="text-emerald-600"
          onClick={() => setOpenCard("owedToMe")}
        />
        <SummaryTile
          label="Xarajatlar"
          hint={`Jami qaytmas chiqim - ${asOfHint}`}
          icon={<Receipt className="h-4 w-4 text-amber-600" />}
          value={totalExpensesUzs}
          loading={potLoading}
          valueClassName="text-amber-600"
          onClick={() => setOpenCard("expenses")}
        />
        <SummaryTile
          label="Olib turilgan pul"
          hint={`Hali qaytarilmagan - ${asOfHint}`}
          icon={<PiggyBank className="h-4 w-4 text-sky-600" />}
          value={fundingBalanceUzs}
          loading={potLoading}
          valueClassName="text-sky-600"
          onClick={() => setOpenCard("funding")}
        />
      </div>

      {/* Filtrlar: mobilda "Filtrlar" tugmasi bilan yig'iladigan panel */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch
            value={view.query}
            onChange={view.setQuery}
            placeholder="Tavsif, hamkor yoki usul bo'yicha qidirish..."
          />
          <Button
            size="sm"
            variant="outline"
            className="md:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <ListFilter className="h-4 w-4" />
            Filtrlar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          {activeFilterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Tozalash
            </Button>
          )}
          <TableExportButton
            fileName="kassa-filtrlangan.csv"
            headers={["Sana", "Yo'nalish", "Tavsif", "Hamkor", "Usuli", "Kirim (so'm)", "Chiqim (so'm)", "Qoldiq (so'm)"]}
            rows={view.filtered.map((r) => [
              formatDateTime(r.date),
              cashRowLabel(r),
              r.description,
              r.partnerName ?? "",
              paymentMethodLabels[r.method] ?? r.method,
              r.direction === "in" ? r.amountUzs : "",
              r.direction === "out" ? r.amountUzs : "",
              r.balanceUzs,
            ])}
          />
        </div>

        <div className={cn("flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-end", filtersOpen ? "flex" : "hidden")}>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sana</Label>
            <div className="flex flex-wrap gap-1.5">
              {quickRanges.map((q) => (
                <Button
                  key={q.key}
                  size="sm"
                  variant={activeQuick === q.key ? "default" : "outline"}
                  onClick={() => {
                    const rg = rangeFor(q.key);
                    setFrom(rg.from);
                    setTo(rg.to);
                  }}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex md:gap-3">
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
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Yo&apos;nalish</Label>
            <Select
              value={directionFilter}
              onValueChange={(v) => v && setDirectionFilter(v)}
              items={directionFilterItems}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {directionFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Hamkor</Label>
            <Select
              value={partnerFilter}
              onValueChange={(v) => v && setPartnerFilter(v)}
              items={partnerFilterItems}
            >
              <SelectTrigger className="w-full md:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partnerFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To&apos;lov usuli</Label>
            <Select
              value={methodFilter}
              onValueChange={(v) => v && setMethodFilter(v)}
              items={methodFilterItems}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodFilterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <MobileSortSelect
            view={view}
            options={[{ key: "date", label: "Sana" }, { key: "partner", label: "Hamkor" }, { key: "amount", label: "Summa" }, { key: "balance", label: "Qoldiq" }]}
          />
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Sana" sortKey="date" view={view} />
                  <TableHead>Yo&apos;nalish</TableHead>
                  <TableHead>Tavsif</TableHead>
                  <SortableHead label="Hamkor" sortKey="partner" view={view} />
                  <TableHead>Usuli</TableHead>
                  <SortableHead label="Summa" sortKey="amount" view={view} align="right" />
                  <SortableHead label="Qoldiq" sortKey="balance" view={view} align="right" />
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.pageItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateTime(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariantFor(r)}>
                        {cashRowLabel(r)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <ExpandableText text={r.description} />
                    </TableCell>
                    <TableCell>
                      {r.partnerName ?? "-"}
                      {r.partnerId && !r.affectsPartnerBalance && (
                        <p className="text-xs text-muted-foreground">Qarzga ta'sir qilmaydi</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {paymentMethodLabels[r.method] ?? r.method}
                      {r.bankAccount && (
                        <p className="text-xs text-muted-foreground">{r.bankAccount}</p>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        r.direction === "in" ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {r.direction === "in" ? "+" : "-"}
                      {formatMoney(r.amountUzs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.balanceUzs)}</TableCell>
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
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>
                    Jami ({view.total} ta): kirim +{formatMoney(totalIn)} · chiqim −{formatMoney(totalOut)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${totalIn - totalOut >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {formatMoney(totalIn - totalOut)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {view.pageItems.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <Badge variant={badgeVariantFor(r)}>
                      {cashRowLabel(r)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(r.date)}
                    </span>
                  </div>
                  <ExpandableText text={r.description} />
                  {r.bankAccount && (
                    <p className="text-xs text-muted-foreground">
                      {paymentMethodLabels[r.method] ?? r.method}: {r.bankAccount}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="truncate">{r.partnerName ?? "-"}</span>
                    <span
                      className={`shrink-0 tabular-nums ${r.direction === "in" ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {r.direction === "in" ? "+" : "-"}
                      {formatMoney(r.amountUzs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-1">
                    <p className="font-medium">
                      <span className="text-muted-foreground font-normal">Qoldiq: </span>
                      <span className="tabular-nums">{formatMoney(r.balanceUzs)}</span>
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => setCancelTarget(r)}>
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="space-y-1 rounded-md border bg-muted p-3 text-sm font-semibold">
              <p className="flex justify-between">
                <span>Jami kirim ({view.total} ta)</span>
                <span className="tabular-nums text-emerald-600" title={formatMoney(totalIn)}>
                  +{formatMoneyCompact(totalIn)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Jami chiqim</span>
                <span className="tabular-nums text-destructive" title={formatMoney(totalOut)}>
                  −{formatMoneyCompact(totalOut)}
                </span>
              </p>
            </div>
          </div>

          <TablePagination
            page={view.page}
            totalPages={view.totalPages}
            total={view.total}
            pageSize={view.pageSize}
            onPageChange={view.setPage}
            onPageSizeChange={view.setPageSize}
          />
        </>
      )}

      <CashTransactionFormDialog direction="in" open={cashInOpen} onOpenChange={setCashInOpen} />
      <CashTransactionFormDialog direction="out" open={cashOutOpen} onOpenChange={setCashOutOpen} />
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      <FundingFormDialog direction="in" open={fundingInOpen} onOpenChange={setFundingInOpen} />

      <CashCardDetailDialog
        card={openCard}
        onClose={() => setOpenCard(null)}
        cardsTo={cardsTo}
        asOfHint={asOfHint}
        partners={cardsPartners}
        partnersLoading={debtsLoading}
      />

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
