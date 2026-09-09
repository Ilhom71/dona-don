"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Download, History, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api, apiUrl, ApiError } from "@/lib/api";
import type { Partner, Sale, PaymentStatus } from "@/lib/types";
import { formatDate, formatMoney, formatQuantity, paymentStatusLabels } from "@/lib/format";

// Savdodagi mahsulotlarni bitta qatorda ko'rsatish uchun ("Un (500 kg), Bug'doy (1 t)").
function itemsSummary(sale: Sale) {
  if (!sale.items?.length) return "-";
  return sale.items
    .map((i) => `${i.product?.name ?? "-"} (${formatQuantity(i.quantity, i.product?.unit ?? "kg")})`)
    .join(", ");
}

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
  cancelled: "outline",
};

export default function SalesHistoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // Savdo tarixida checkbox bilan belgilangan qatorlar (ID to'plami).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["sales", partnerFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (partnerFilter !== "all") params.set("partnerId", partnerFilter);
      if (statusFilter !== "all") params.set("paymentStatus", statusFilter);
      const qs = params.toString();
      return api.get<Sale[]>(`/sales${qs ? `?${qs}` : ""}`);
    },
  });
  // Bekor qilingan savdolar bu ro'yxatda ko'rinmaydi - Arxivning "Bekor
  // qilingan savdolar" qismida ko'rinadi.
  const data = rawData?.filter((s) => !s.cancelledAt);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(data?.map((s) => s.id) ?? []));
    else setSelected(new Set());
  }

  const allChecked = !!data?.length && data.every((s) => selected.has(s.id));

  // Faqat belgilangan savdolarni Excel'ga eksport qiladi (butun ro'yxat emas).
  async function handleExportSelected() {
    try {
      const res = await fetch(apiUrl("/excel/sales/export"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Export qilishda xatolik");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "savdolar.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Excel faylni yuklab olishda xatolik yuz berdi");
    }
  }

  const cancelBulkMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: { id: string; ok: boolean; error?: string }[] }>(
        "/sales/cancel-bulk",
        { ids: Array.from(selected) }
      ),
    onSuccess: (res) => {
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(`${res.results.length} ta savdo bekor qilindi`);
      } else {
        toast.error(
          `${res.results.length - failed.length} ta bekor qilindi, ${failed.length} tasi xato: ${failed[0].error}`
        );
      }
      setSelected(new Set());
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Savdo tarixi</h1>
          <p className="text-sm text-muted-foreground">Barcha amalga oshirilgan savdolar</p>
        </div>
        <ExcelActions exportPath="/excel/sales/export" exportFileName="savdolar.xlsx" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={partnerFilter}
          onValueChange={(v) => setPartnerFilter(v ?? "all")}
          items={[
            { value: "all", label: "Barcha hamkorlar" },
            ...(partners?.map((p) => ({ value: p.id, label: p.name })) ?? []),
          ]}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Barcha hamkorlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha hamkorlar</SelectItem>
            {partners?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
          items={[
            { value: "all", label: "Barcha holatlar" },
            { value: "paid", label: "To'liq to'langan" },
            { value: "partial", label: "Qisman to'langan" },
            { value: "credit", label: "Nasiya" },
          ]}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            <SelectItem value="paid">To'liq to'langan</SelectItem>
            <SelectItem value="partial">Qisman to'langan</SelectItem>
            <SelectItem value="credit">Nasiya</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
          <span className="font-medium">{selected.size} ta savdo tanlandi</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportSelected}>
              <Download className="h-4 w-4" />
              Excel'ga eksport
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="h-4 w-4" />
              Bekor qilish
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <History className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha savdo qilinmagan</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Barchasini tanlash"
                    />
                  </TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Hamkor</TableHead>
                  <TableHead>Mahsulot(lar)</TableHead>
                  <TableHead>Mashina raqami</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead>To'langan</TableHead>
                  <TableHead>Holati</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={(v) => toggleOne(s.id, !!v)}
                        aria-label="Savdoni tanlash"
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/savdo/tarix/${s.id}`} className="block">
                        {formatDate(s.saleDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {/* Hamkor nomini bosganda uning to'liq hisob-varag'i (image.png
                          uslubidagi jadval) alohida sahifada ochiladi. */}
                      <Link
                        href={`/savdo/hamkorlar/${s.partnerId}`}
                        className="block font-medium hover:underline"
                      >
                        {s.partner?.name ?? "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64 truncate" title={itemsSummary(s)}>
                      {itemsSummary(s)}
                    </TableCell>
                    <TableCell>{s.vehicleNumber ?? "-"}</TableCell>
                    <TableCell>{formatMoney(s.totalAmount, s.currency)}</TableCell>
                    <TableCell>{formatMoney(s.paidAmountUzs)}</TableCell>
                    <TableCell>
                      <Link href={`/savdo/tarix/${s.id}`} className="block">
                        <Badge variant={statusVariant[s.paymentStatus]}>
                          {paymentStatusLabels[s.paymentStatus]}
                        </Badge>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {data.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(s.id)}
                      onCheckedChange={(v) => toggleOne(s.id, !!v)}
                      aria-label="Savdoni tanlash"
                    />
                    {/* Savdo tafsilotiga o'tish uchun bosiladigan hudud - hamkor nomi
                        alohida <Link> bo'lgani uchun ichma-ich <a> bo'lmasligi uchun
                        div + router.push ishlatilgan. */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/savdo/tarix/${s.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            href={`/savdo/hamkorlar/${s.partnerId}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.partner?.name ?? "-"}
                          </Link>
                          <p className="text-sm text-muted-foreground">{formatDate(s.saleDate)}</p>
                        </div>
                        <Badge variant={statusVariant[s.paymentStatus]}>
                          {paymentStatusLabels[s.paymentStatus]}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {itemsSummary(s)}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        {s.vehicleNumber ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Truck className="h-3.5 w-3.5" /> {s.vehicleNumber}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="font-medium">
                          {formatMoney(s.totalAmount, s.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tanlangan savdolarni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} ta savdo bekor qilinadi: sotilgan mahsulotlar omborga qaytariladi va
              holati &quot;Bekor qilingan&quot; deb belgilanadi. Yozuvlar o&apos;zi o&apos;chirilmaydi
              (audit tarixi saqlanadi). Davom etasizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo'q</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelBulkMutation.mutate()}
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
