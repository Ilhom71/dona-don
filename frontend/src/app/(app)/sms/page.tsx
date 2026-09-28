"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Phone, Send, ShieldUser, Users, Wallet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ExpandableText,
  MobileSortSelect,
  SortableHead,
  TablePagination,
  TableSearch,
} from "@/components/table-controls";
import { useTableView } from "@/hooks/use-table-view";
import { api, ApiError } from "@/lib/api";
import type { Partner, SendSmsResponse, SmsBalance, SmsLog, SmsStats } from "@/lib/types";
import { formatDateTime, smsStatusLabels } from "@/lib/format";
import { cn } from "@/lib/utils";

const uzsNumberFormatter = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });

/**
 * Hamkorga yuboriladigan yagona tasdiqlangan SMS shabloni - backenddagi
 * `buildSmsMessage` bilan bir xil format (faqat oldindan ko'rsatish uchun,
 * haqiqiy matn har doim serverda tuziladi).
 */
function previewSmsMessage(partner: Partner): string {
  const phoneDigits = (partner.phone ?? "").replace(/\D/g, "");
  return `Dona Don Group: Assalomu alaykum, hurmatli ${partner.name} aka. Ortamizdagi hisob: ${uzsNumberFormatter.format(Math.abs(Math.round(partner.balanceUzs)))} som. Tel:+${phoneDigits}`;
}

/**
 * SMS bo'limi - TextUP orqali hamkorlarga qat'iy belgilangan shablon bo'yicha
 * SMS yuborish. Erkin matn yoki boshqa shablon tanlash yo'q - hamkor
 * ro'yxatidan bittasi yoki bir nechtasi (yoki barchasi) belgilanadi, har biriga
 * o'zining ismi/balansi/telefoni bilan to'ldirilgan xabar ketadi. Pastda
 * yuborilgan SMS'lar tarixi (kimga, qachon, qaysi holatda) ko'rinadi.
 */
export default function SmsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  // "Bu oy yuborilgan SMS soni" - TextUP'da balans/limit endpointi yo'qligi
  // sababli, o'zimizning yuborish tarixidan hisoblanadi (haqiqiy operator
  // balansi emas, faqat shu tizim orqali yuborilganlar statistikasi).
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["sms-stats"],
    queryFn: () => api.get<SmsStats>("/sms/stats"),
  });

  // Ichki SMS balansi (Admin bo'limida qo'lda to'ldiriladi) - tugasa yangi
  // SMS yuborib bo'lmaydi.
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: () => api.get<SmsBalance>("/sms/balance"),
  });
  const smsBalance = balance?.balance ?? 0;
  const balanceEmpty = !balanceLoading && smsBalance <= 0;

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: () => api.get<SmsLog[]>("/sms/logs"),
  });

  const partnersView = useTableView(
    partners ?? [],
    (p) => `${p.name} ${p.phone ?? ""}`,
    20,
    { name: (p) => p.name, phone: (p) => p.phone }
  );
  // Faqat telefon raqami bor hamkorlarga SMS yuborish mumkin - "Barchasini
  // tanlash" ham faqat shularni belgilaydi.
  const selectableIds = useMemo(
    () => partnersView.filtered.filter((p) => p.phone).map((p) => p.id),
    [partnersView.filtered]
  );
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectableIds) : new Set());
  }

  const logsView = useTableView(
    logs ?? [],
    (l) => `${l.partnerName} ${l.phone} ${l.message} ${smsStatusLabels[l.status] ?? l.status}`,
    20,
    { date: (l) => Date.parse(l.sentAt), partner: (l) => l.partnerName }
  );

  const selectedPartners = useMemo(
    () => (partners ?? []).filter((p) => selected.has(p.id)),
    [partners, selected]
  );

  const sendMutation = useMutation({
    mutationFn: () => api.post<SendSmsResponse>("/sms/send", { partnerIds: Array.from(selected) }),
    onSuccess: (res) => {
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(`${res.results.length} ta hamkorga SMS yuborildi`);
      } else {
        toast.error(
          `${res.results.length - failed.length} ta yuborildi, ${failed.length} tasi xato: ${failed[0].error}`
        );
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
      queryClient.invalidateQueries({ queryKey: ["sms-stats"] });
      queryClient.invalidateQueries({ queryKey: ["sms-balance"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setConfirmOpen(false),
  });

  const canSend = selected.size > 0 && !balanceEmpty;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SMS</h1>
          <p className="text-sm text-muted-foreground">
            Hamkorlarga belgilangan shablon bo&apos;yicha SMS yuborish (TextUP orqali) va yuborilganlar tarixi
          </p>
        </div>
        {/* SMS balansini to'ldirish - asosiy admindan MUSTAQIL, alohida login/parol talab qiladi */}
        <Link href="/sms/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ShieldUser className="h-4 w-4" />
          Admin
        </Link>
      </div>

      {/* Qolgan SMS (ichki balans) va bu oy yuborilganlar soni */}
      <div className="flex flex-wrap gap-2">
        <Card size="sm" className="w-fit">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <Wallet className={cn("h-5 w-5", balanceEmpty ? "text-destructive" : "text-muted-foreground")} />
            <div>
              <p className="text-xs text-muted-foreground">Qolgan SMS</p>
              {balanceLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className={cn("text-lg font-semibold tabular-nums", balanceEmpty && "text-destructive")}>
                  {smsBalance} ta
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="w-fit">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Bu oy yuborilgan SMS</p>
              {statsLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-lg font-semibold tabular-nums">{stats?.sentThisMonth ?? 0} ta</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {balanceEmpty && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          SMS balansi tugagan - yangi SMS yuborish uchun{" "}
          <Link href="/sms/admin" className="font-medium underline underline-offset-2">
            Admin
          </Link>{" "}
          bo&apos;limidan to&apos;ldiring.
        </div>
      )}

      {/* Xabar matni sobit shablon - har bir hamkorga o'z ismi/balansi/telefoni bilan to'ldirilib yuboriladi */}
      <Card>
        <CardContent className="space-y-1.5 p-4">
          <p className="text-sm font-medium">Yuboriladigan shablon</p>
          <p className="rounded-md border bg-muted p-2 text-xs text-muted-foreground">
            Dona Don Group: Assalomu alaykum, hurmatli {"{HAMKOR_NOMI}"} aka. Ortamizdagi hisob: {"{BALANS}"} som.
            Tel:+{"{TELEFON}"}
          </p>
        </CardContent>
      </Card>

      {/* Tanlangan hamkorlar paneli */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{selected.size} ta hamkor tanlandi</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Bekor qilish
            </Button>
            <Button
              size="sm"
              disabled={!canSend || sendMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="h-4 w-4" />
              SMS yuborish
            </Button>
          </div>
        </div>
      )}

      <TableSearch
        value={partnersView.query}
        onChange={partnersView.setQuery}
        placeholder="Hamkor nomi yoki telefon bo'yicha qidirish..."
      />

      {partnersLoading ? (
        <Skeleton className="h-64" />
      ) : (partners ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hamkorlar hali qo&apos;shilmagan</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <MobileSortSelect
            view={partnersView}
            options={[{ key: "name", label: "Ism" }, { key: "phone", label: "Telefon" }]}
          />
          {/* Desktop: to'liq jadval */}
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      disabled={selectableIds.length === 0}
                      aria-label="Barchasini tanlash"
                    />
                  </TableHead>
                  <SortableHead label="Ism" sortKey="name" view={partnersView} />
                  <SortableHead label="Telefon" sortKey="phone" view={partnersView} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnersView.pageItems.map((p) => (
                  <TableRow key={p.id} className={cn(!p.phone && "opacity-60")}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={(v) => toggleOne(p.id, !!v)}
                        disabled={!p.phone}
                        aria-label="Hamkorni tanlash"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.phone ?? (
                        <Badge variant="outline" className="font-normal">
                          Telefon yo&apos;q
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobil: kartochka ro'yxati */}
          <div className="space-y-2 md:hidden">
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => toggleAll(!!v)}
                disabled={selectableIds.length === 0}
              />
              <span className="font-medium">Barchasini tanlash</span>
            </label>
            {partnersView.pageItems.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-sm",
                  !p.phone && "opacity-60"
                )}
              >
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={(v) => toggleOne(p.id, !!v)}
                  disabled={!p.phone}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {p.phone ?? "Telefon yo'q"}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <TablePagination
            page={partnersView.page}
            totalPages={partnersView.totalPages}
            total={partnersView.total}
            pageSize={partnersView.pageSize}
            onPageChange={partnersView.setPage}
            onPageSizeChange={partnersView.setPageSize}
          />
        </>
      )}

      {/* Yuborilgan SMS tarixi */}
      <div className="space-y-3 pt-4">
        <div>
          <h2 className="text-lg font-semibold">Yuborilgan SMS tarixi</h2>
          <p className="text-sm text-muted-foreground">Kimga, qachon va qanday holatda yuborilgani</p>
        </div>

        <TableSearch
          value={logsView.query}
          onChange={logsView.setQuery}
          placeholder="Hamkor, telefon yoki xabar bo'yicha qidirish..."
        />

        {logsLoading ? (
          <Skeleton className="h-64" />
        ) : (logs ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Hali SMS yuborilmagan</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <MobileSortSelect
              view={logsView}
              options={[{ key: "date", label: "Sana" }, { key: "partner", label: "Hamkor" }]}
            />
            {/* Desktop: to'liq jadval */}
            <Card className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Sana" sortKey="date" view={logsView} />
                    <SortableHead label="Hamkor" sortKey="partner" view={logsView} />
                    <TableHead>Telefon</TableHead>
                    <TableHead>Xabar</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsView.pageItems.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatDateTime(l.sentAt)}</TableCell>
                      <TableCell>{l.partnerName}</TableCell>
                      <TableCell>{l.phone}</TableCell>
                      <TableCell className="max-w-72">
                        <ExpandableText text={l.message} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.status === "sent" ? "default" : "destructive"}
                          title={l.errorMessage ?? undefined}
                        >
                          {smsStatusLabels[l.status] ?? l.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobil: kartochka ro'yxati */}
            <div className="space-y-2 md:hidden">
              {logsView.pageItems.map((l) => (
                <Card key={l.id}>
                  <CardContent className="space-y-1 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{l.partnerName}</span>
                      <Badge
                        variant={l.status === "sent" ? "default" : "destructive"}
                        title={l.errorMessage ?? undefined}
                      >
                        {smsStatusLabels[l.status] ?? l.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{l.phone}</p>
                    <ExpandableText text={l.message} />
                    <p className="text-xs text-muted-foreground">{formatDateTime(l.sentAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <TablePagination
              page={logsView.page}
              totalPages={logsView.totalPages}
              total={logsView.total}
              pageSize={logsView.pageSize}
              onPageChange={logsView.setPage}
              onPageSizeChange={logsView.setPageSize}
            />
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>SMS yuborish</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selected.size} ta</strong> hamkorga quyidagi shablon bo&apos;yicha (har biriga o&apos;z
              ismi/balansi bilan) SMS yuborilsinmi?
              {selectedPartners[0] && (
                <span className="mt-2 block rounded-md border bg-muted p-2 text-foreground">
                  {previewSmsMessage(selectedPartners[0])}
                  {selectedPartners.length > 1 && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      (namuna - {selectedPartners[0].name} uchun, qolgan {selectedPartners.length - 1} tasi ham
                      o&apos;z ma&apos;lumotlari bilan)
                    </span>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo&apos;q</AlertDialogCancel>
            <AlertDialogAction disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              {sendMutation.isPending ? "Yuborilmoqda..." : "Ha, yuborish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
