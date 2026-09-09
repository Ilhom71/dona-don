"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Package,
  Pencil,
  Scale,
  Trash2,
  Warehouse as WarehouseIcon,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { WarehouseFormDialog } from "@/components/warehouse-form-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
import { api, ApiError } from "@/lib/api";
import type { ProductStock, StockLot, Warehouse } from "@/lib/types";
import { formatDate, formatMoney, formatQuantity, movementSourceLabels } from "@/lib/format";

/** Turli o'lchov birligidagi (kg/ton) qoldiqlarni bitta kg qiymatiga normallashtiradi. */
function toKg(qty: number, unit: "kg" | "ton") {
  return unit === "ton" ? qty * 1000 : qty;
}

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });
  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: () => api.get<ProductStock[]>("/stock/levels"),
  });
  // Har xil narxda kirim qilingan (masalan har xil hamkordan olingan)
  // bug'doyning har biri alohida partiya sifatida - shu yerdan olinadi.
  const { data: lots } = useQuery({
    queryKey: ["stock-lots"],
    queryFn: () => api.get<StockLot[]>("/stock/lots"),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [viewing, setViewing] = useState<Warehouse | null>(null);
  const [adjusting, setAdjusting] = useState<ProductStock | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      toast.success("Ombor arxivga o'tkazildi");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["archived-warehouses"] });
      // Shu ombordagi qoldiq endi "faol" hisoblanmaydi - qoldiq ko'rinishlari
      // va bosh sahifa ham yangilanishi kerak.
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setDeleting(null),
  });

  function stockFor(warehouseId: string) {
    return (stockLevels ?? []).filter((s) => s.warehouseId === warehouseId && Number(s.quantity) > 0);
  }

  function lotsFor(warehouseId: string, productId: string) {
    return (lots ?? []).filter((l) => l.warehouseId === warehouseId && l.productId === productId);
  }

  function summaryFor(warehouseId: string) {
    const rows = stockFor(warehouseId);
    const totalKg = rows.reduce(
      (sum, r) => sum + toKg(Number(r.quantity), r.product?.unit ?? "kg"),
      0
    );
    const totalValueUzs = rows.reduce(
      (sum, r) => sum + Number(r.quantity) * Number(r.avgCostUzs),
      0
    );
    return { productCount: rows.length, totalKg, totalValueUzs };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Omborlar</h1>
          <p className="text-sm text-muted-foreground">
            Har bir omborda qancha mahsulot va qiymat borligi - kartaga bosib ko&apos;ring
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Yangi ombor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : !warehouses || warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <WarehouseIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha ombor qo'shilmagan</p>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Birinchi omborni qo'shish
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => {
            const summary = summaryFor(w.id);
            return (
              <Card
                key={w.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => setViewing(w)}
              >
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <WarehouseIcon className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium leading-tight">{w.name}</p>
                        {w.address && (
                          <p className="text-xs text-muted-foreground">{w.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(w);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(w);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Jami og&apos;irlik</p>
                      <p className="font-medium">{formatQuantity(summary.totalKg, "kg")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jami qiymat</p>
                      <p className="font-medium">{formatMoney(summary.totalValueUzs)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.productCount} turdagi mahsulot
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <WarehouseFormDialog warehouse={editing} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Omborni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.name}&quot; omborini o'chirmoqchimisiz? Yozuv butunlay o'chmaydi -
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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WarehouseIcon className="h-5 w-5" /> {viewing?.name}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {summaryFor(viewing.id).productCount} turdagi mahsulot,{" "}
                  {formatMoney(summaryFor(viewing.id).totalValueUzs)}
                </p>
                <Link
                  href={`/ombor/kirim?warehouseId=${viewing.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Kirim qilish
                </Link>
              </div>

              {stockFor(viewing.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">Bu omborda hozircha mahsulot yo&apos;q</p>
                </div>
              ) : (
                <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                  {stockFor(viewing.id).map((s) => {
                    const productLots = lotsFor(viewing.id, s.productId);
                    return (
                      <div key={s.id} className="rounded-md border">
                        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 p-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.product?.name ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">
                              Jami: {formatQuantity(s.quantity, s.product?.unit ?? "kg")} -{" "}
                              {formatMoney(Number(s.quantity) * Number(s.avgCostUzs))}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Miqdorni to'g'irlash (inventarizatsiya)"
                            onClick={() => setAdjusting(s)}
                          >
                            <Scale className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Har xil narxda kirim qilingan (masalan har xil hamkordan
                            olingan) partiyalar bu yerda alohida-alohida ko'rinadi -
                            biri "2,000/kg" bo'lsa boshqasi "3,000/kg" aralashib
                            ketmaydi. */}
                        <div className="divide-y">
                          {productLots.length === 0 ? (
                            <p className="p-2.5 text-xs text-muted-foreground">
                              Partiya ma&apos;lumoti yo&apos;q
                            </p>
                          ) : (
                            productLots.map((lot) => (
                              <div
                                key={lot.id}
                                className="flex items-center justify-between gap-2 p-2.5 text-sm"
                              >
                                <div className="min-w-0">
                                  <p>
                                    {formatQuantity(lot.remainingQuantity, s.product?.unit ?? "kg")} -{" "}
                                    <span className="font-medium">{formatMoney(lot.unitCostUzs)}</span>
                                    /birlik
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {lot.supplierName ?? movementSourceLabels[lot.source] ?? lot.source}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {formatDate(lot.receivedAt)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {adjusting && (
        <StockAdjustmentDialog
          productId={adjusting.productId}
          warehouseId={adjusting.warehouseId}
          productName={adjusting.product?.name ?? "-"}
          unit={adjusting.product?.unit ?? "kg"}
          currentQuantity={Number(adjusting.quantity)}
          open={!!adjusting}
          onOpenChange={(o) => !o && setAdjusting(null)}
        />
      )}
    </div>
  );
}
