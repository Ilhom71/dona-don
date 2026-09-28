"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LogOut, ShieldUser, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import type { SmsCreditsResponse } from "@/lib/types";
import { formatDateTime, formatMoney, smsCreditTypeLabels } from "@/lib/format";

/**
 * SMS bo'limi ichidagi "Admin" qismi - SMS balansini (kredit) boshqarish.
 * Asosiy tizim login/paroli bilan BOG'LIQ EMAS - foydalanuvchi so'roviga
 * ko'ra bu yerga kirish uchun alohida (mustaqil) login/parol so'raladi.
 * TextUP'da haqiqiy to'lov/xarid API'si yo'qligi sababli, "sotib olish"
 * shu yerda ADMIN tomonidan haqiqiy TextUP xaridi qilingandan KEYIN qo'lda
 * qayd etiladi (avtomatik to'lov ULANMAGAN).
 */
export default function SmsAdminPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  // SMS Admin sessiyasi bormi - asosiy `useAuth`dan mustaqil, shuning uchun
  // alohida (shu sahifaga xos) tekshiruv.
  const {
    data: me,
    isLoading: meLoading,
    isError: meError,
  } = useQuery({
    queryKey: ["sms-admin-me"],
    queryFn: () => api.get<{ smsAdminId: string }>("/sms-admin/me"),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: () => api.post("/sms-admin/login", { username, password }),
    onSuccess: () => {
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["sms-admin-me"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Kirishda xatolik"),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/sms-admin/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-admin-me"] });
      queryClient.removeQueries({ queryKey: ["sms-admin-credits"] });
    },
  });

  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ["sms-admin-credits"],
    queryFn: () => api.get<SmsCreditsResponse>("/sms-admin/credits"),
    enabled: !!me,
  });

  const topupMutation = useMutation({
    mutationFn: () =>
      api.post("/sms-admin/credits/topup", {
        quantity: Number(quantity),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`${quantity} ta SMS krediti qo'shildi`);
      setQuantity("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["sms-admin-credits"] });
      // Asosiy SMS sahifasidagi "Qolgan SMS" ko'rsatkichi ham yangilansin.
      queryClient.invalidateQueries({ queryKey: ["sms-balance"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  const priceUzs = credits?.priceUzs ?? 200;
  const quantityNum = Number(quantity) || 0;
  const totalUzs = quantityNum * priceUzs;
  const canTopup = quantityNum > 0 && Number.isInteger(quantityNum) && !topupMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/sms" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">SMS Admin</h1>
          <p className="text-sm text-muted-foreground">
            SMS balansini to&apos;ldirish - asosiy tizimdan mustaqil kirish
          </p>
        </div>
      </div>

      {meLoading ? (
        <Skeleton className="h-64" />
      ) : meError || !me ? (
        // ---------- Login formasi ----------
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <ShieldUser className="mb-1 h-10 w-10 text-muted-foreground" />
            <CardTitle>SMS Admin kirish</CardTitle>
            <CardDescription>Bu bo&apos;lim uchun alohida login va parol talab qilinadi</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="sms-admin-username">Login</Label>
                <Input
                  id="sms-admin-username"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-admin-password">Parol</Label>
                <Input
                  id="sms-admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Kirilmoqda..." : "Kirish"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        // ---------- Balans boshqaruvi ----------
        <>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Joriy balans + narx */}
            <Card size="sm" className="w-fit">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Joriy SMS balansi</p>
                  {creditsLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <p className="text-lg font-semibold tabular-nums">{credits?.balance ?? 0} ta</p>
                  )}
                  <p className="text-xs text-muted-foreground">1 SMS = {formatMoney(priceUzs)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SMS sotib olish (qo'lda qayd etish) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SMS sotib olindi</CardTitle>
              <CardDescription>
                TextUP orqali haqiqatda sotib olgandan so&apos;ng, shu yerda qo&apos;lda qayd eting -
                narx avtomatik hisoblanadi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canTopup) topupMutation.mutate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sms-quantity">Necha dona SMS</Label>
                    <Input
                      id="sms-quantity"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="Masalan: 100"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jami narx</Label>
                    <p className="flex h-8 items-center text-lg font-semibold tabular-nums">
                      {formatMoney(totalUzs)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-note">Izoh (ixtiyoriy)</Label>
                  <Textarea
                    id="sms-note"
                    placeholder="Masalan: TextUP orqali to'landi, chek raqami..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button type="submit" disabled={!canTopup}>
                  {topupMutation.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Balans tarixi */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Balans tarixi</h2>
            {creditsLoading ? (
              <Skeleton className="h-48" />
            ) : !credits?.history.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">Hali hech narsa qo&apos;shilmagan</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead className="text-right">Miqdor</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Izoh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credits.history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{formatDateTime(h.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={h.type === "usage" ? "destructive" : "default"}>
                            {smsCreditTypeLabels[h.type] ?? h.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${h.amount < 0 ? "text-destructive" : "text-emerald-600"}`}
                        >
                          {h.amount > 0 ? "+" : ""}
                          {h.amount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {h.totalUzs ? formatMoney(h.totalUzs) : "-"}
                        </TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground" title={h.note ?? undefined}>
                          {h.note ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
