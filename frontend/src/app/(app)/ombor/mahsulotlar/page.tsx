"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ProductFormDialog } from "@/components/product-form-dialog";
import { ExcelActions } from "@/components/excel-actions";
import { api, ApiError } from "@/lib/api";
import type { Product, ProductStock } from "@/lib/types";
import { formatMoney, formatQuantity, unitLabels } from "@/lib/format";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: () => api.get<ProductStock[]>("/stock/levels"),
  });

  const warehouseBreakdown = (productId: string) =>
    (stockLevels ?? []).filter((s) => s.productId === productId && Number(s.quantity) > 0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Mahsulot o'chirildi");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    onSettled: () => setDeleting(null),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mahsulotlar</h1>
          <p className="text-sm text-muted-foreground">Ombordagi don turlari va qoldiqlar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelActions
            exportPath="/excel/products/export"
            exportFileName="mahsulotlar.xlsx"
            importPath="/excel/products/import"
            invalidateKey="products"
          />
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Yangi mahsulot
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha mahsulot qo'shilmagan</p>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Birinchi mahsulotni qo'shish
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomi</TableHead>
                  <TableHead>Birlik</TableHead>
                  <TableHead>Qoldiq</TableHead>
                  <TableHead>Omborlar</TableHead>
                  <TableHead>Tan narx</TableHead>
                  <TableHead>Sotuv narxi</TableHead>
                  <TableHead className="text-right">Jami qiymat</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{unitLabels[p.unit]}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {formatQuantity(p.stockQuantity, p.unit)}
                        {p.minStockAlert && Number(p.stockQuantity) <= Number(p.minStockAlert) && (
                          <Badge variant="destructive">kam qoldi</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {warehouseBreakdown(p.id).length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          warehouseBreakdown(p.id).map((s) => (
                            <Badge key={s.id} variant="outline">
                              {s.warehouse?.name}: {formatQuantity(s.quantity, p.unit)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatMoney(p.avgCostUzs)}</TableCell>
                    <TableCell>
                      {p.sellingPriceUzs ? formatMoney(p.sellingPriceUzs) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(p.stockQuantity) * Number(p.avgCostUzs))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/savdo/yangi?productId=${p.id}`}
                          title="Sotish"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Link>
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

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{unitLabels[p.unit]}</p>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        href={`/savdo/yangi?productId=${p.id}`}
                        title="Sotish"
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Link>
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
                    <span className="flex items-center gap-2">
                      Qoldiq: {formatQuantity(p.stockQuantity, p.unit)}
                      {p.minStockAlert && Number(p.stockQuantity) <= Number(p.minStockAlert) && (
                        <Badge variant="destructive">kam</Badge>
                      )}
                    </span>
                  </div>
                  {warehouseBreakdown(p.id).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {warehouseBreakdown(p.id).map((s) => (
                        <Badge key={s.id} variant="outline">
                          {s.warehouse?.name}: {formatQuantity(s.quantity, p.unit)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Tan narx: {formatMoney(p.avgCostUzs)}</span>
                    <span>Sotuv: {p.sellingPriceUzs ? formatMoney(p.sellingPriceUzs) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-muted-foreground font-normal">Jami qiymat</span>
                    <span>{formatMoney(Number(p.stockQuantity) * Number(p.avgCostUzs))}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <ProductFormDialog product={editing} open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mahsulotni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.name}&quot; mahsulotini o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.
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
