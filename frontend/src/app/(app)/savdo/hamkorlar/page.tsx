"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Wallet,
  ShoppingCart,
  FileSpreadsheet,
  History,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { PaymentFormDialog } from "@/components/payment-form-dialog";
import { BalanceBadge } from "@/components/balance-badge";
import { api, apiUrl, ApiError } from "@/lib/api";
import type { Partner } from "@/lib/types";
import { partnerTypeLabels } from "@/lib/format";

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState<Partner | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partners/${id}`),
    onSuccess: () => {
      toast.success("Hamkor arxivga o'tkazildi");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["archived-partners"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setDeleting(null),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hamkorlar</h1>
          <p className="text-sm text-muted-foreground">Mijozlar va yetkazib beruvchilar</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi hamkor
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha hamkor qo'shilmagan</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ismi / nomi</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Balans</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/savdo/hamkorlar/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{partnerTypeLabels[p.type]}</TableCell>
                    <TableCell>{p.phone ?? "-"}</TableCell>
                    <TableCell>
                      <BalanceBadge value={p.balanceUzs} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/savdo/hamkorlar/${p.id}`}
                          title="Tarix"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <History className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/savdo/yangi?partnerId=${p.id}`}
                          title="Sotish"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="To'lov qo'shish"
                          onClick={() => setPaymentTarget(p)}
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                        <a
                          href={apiUrl(`/excel/partners/${p.id}/statement`)}
                          title="Hisob-varaq (Excel)"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {data.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/savdo/hamkorlar/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{partnerTypeLabels[p.type]}</p>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        href={`/savdo/hamkorlar/${p.id}`}
                        title="Tarix"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                      >
                        <History className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/savdo/yangi?partnerId=${p.id}`}
                        title="Sotish"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => setPaymentTarget(p)}>
                        <Wallet className="h-4 w-4" />
                      </Button>
                      <a
                        href={apiUrl(`/excel/partners/${p.id}/statement`)}
                        title="Hisob-varaq (Excel)"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.phone ?? "-"}</span>
                    <BalanceBadge value={p.balanceUzs} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <PartnerFormDialog partner={editing} open={formOpen} onOpenChange={setFormOpen} />
      {paymentTarget && (
        <PaymentFormDialog
          partnerId={paymentTarget.id}
          open={!!paymentTarget}
          onOpenChange={(o) => !o && setPaymentTarget(null)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hamkorni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.name}&quot; hamkorini o'chirmoqchimisiz? Yozuv butunlay o'chmaydi -
              &quot;Arxiv&quot; bo&apos;limiga o&apos;tadi va kerak bo&apos;lsa qaytarib tiklash mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
