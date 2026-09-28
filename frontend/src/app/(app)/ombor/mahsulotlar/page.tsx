"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, ShoppingCart, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ProductFormDialog } from "@/components/product-form-dialog";
import { ProductBulkCreateDialog } from "@/components/product-bulk-create-dialog";
import { ExcelActions } from "@/components/excel-actions";
import {
  MobileSortSelect,
  SortableHead,
  TablePagination,
  TableSearch,
} from "@/components/table-controls";
import { useTableView } from "@/hooks/use-table-view";
import { api, ApiError } from "@/lib/api";
import type { Product, ProductStock, StockLot } from "@/lib/types";
import { formatDate, formatMoney, formatQuantity, movementSourceLabels, unitLabels } from "@/lib/format";

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
  // Har xil narxda kirim qilingan (masalan har xil hamkordan olingan) don
  // - har biri o'z narxi bilan alohida "partiya" - "Partiyalar" oynasida
  // ko'rsatiladi, o'rtacha tan narxga aralashtirilmasdan.
  const { data: lots } = useQuery({
    queryKey: ["stock-lots"],
    queryFn: () => api.get<StockLot[]>("/stock/lots"),
  });

  const warehouseBreakdown = (productId: string) =>
    (stockLevels ?? []).filter((s) => s.productId === productId && Number(s.quantity) > 0);

  const lotsForProduct = (productId: string) => (lots ?? []).filter((l) => l.productId === productId);

  const products = useMemo(() => data ?? [], [data]);
  const view = useTableView(products, (p) => `${p.name} ${p.notes ?? ""}`, 20, {
    // Saralanadigan ustunlar: nom, qoldiq (kg'ga keltirilgan), tan narx, sotuv narxi, jami qiymat
    name: (p) => p.name,
    stock: (p) => Number(p.stockQuantity) * (p.unit === "ton" ? 1000 : 1),
    cost: (p) => Number(p.avgCostUzs),
    price: (p) => (p.sellingPriceUzs === null ? null : Number(p.sellingPriceUzs)),
    value: (p) => Number(p.stockQuantity) * Number(p.avgCostUzs),
  });
  // Jami qator: qoldiq kg'da (1 t = 1000 kg) va umumiy qiymat - qidiruvdan o'tgan barcha qatorlar bo'yicha.
  const totalKg = view.filtered.reduce(
    (sum, p) => sum + Number(p.stockQuantity) * (p.unit === "ton" ? 1000 : 1),
    0
  );
  const totalValue = view.filtered.reduce(
    (sum, p) => sum + Number(p.stockQuantity) * Number(p.avgCostUzs),
    0
  );

  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [viewingLots, setViewingLots] = useState<Product | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success("Mahsulot arxivga o'tkazildi");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
      // Omborlardagi qoldiq ko'rinishlari va bosh sahifa ham yangilanishi kerak.
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
            templatePath="/excel/products/template"
            invalidateKey="products"
          />
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <Plus className="h-4 w-4" />
            Yangi mahsulot
          </Button>
        </div>
      </div>

      <TableSearch
        value={view.query}
        onChange={view.setQuery}
        placeholder="Mahsulot nomi bo'yicha qidirish..."
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha mahsulot qo'shilmagan</p>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <Plus className="h-4 w-4" />
              Birinchi mahsulotni qo'shish
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <MobileSortSelect
            view={view}
            options={[{ key: "name", label: "Nomi" }, { key: "stock", label: "Qoldiq" }, { key: "cost", label: "Tan narx" }, { key: "price", label: "Sotuv narxi" }, { key: "value", label: "Jami qiymat" }]}
          />
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Nomi" sortKey="name" view={view} />
                  <TableHead>Birlik</TableHead>
                  <SortableHead label="Qoldiq" sortKey="stock" view={view} />
                  <TableHead>Omborlar</TableHead>
                  <SortableHead label="Tan narx" sortKey="cost" view={view} />
                  <SortableHead label="Sotuv narxi" sortKey="price" view={view} />
                  <SortableHead label="Jami qiymat" sortKey="value" view={view} align="right" />
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.pageItems.map((p) => (
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
                          title="Partiyalar (har xil tan narxlar)"
                          onClick={() => setViewingLots(p)}
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
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
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Jami ({view.total} ta mahsulot)</TableCell>
                  <TableCell>{formatQuantity(totalKg, "kg")}</TableCell>
                  <TableCell colSpan={3} />
                  <TableCell className="text-right">{formatMoney(totalValue)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {view.pageItems.map((p) => (
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
                        title="Partiyalar (har xil tan narxlar)"
                        onClick={() => setViewingLots(p)}
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
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
            <div className="space-y-1 rounded-md border bg-muted p-3 text-sm font-semibold">
              <p className="flex justify-between">
                <span>Jami qoldiq ({view.total} ta)</span>
                <span>{formatQuantity(totalKg, "kg")}</span>
              </p>
              <p className="flex justify-between">
                <span>Jami qiymat</span>
                <span>{formatMoney(totalValue)}</span>
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

      <ProductFormDialog product={editing} open={formOpen} onOpenChange={setFormOpen} />
      <ProductBulkCreateDialog open={bulkOpen} onOpenChange={setBulkOpen} />

      {/* Har xil narxda kirim qilingan partiyalar (masalan har xil hamkordan
          olingan bug'doy) - o'rtacha tan narxga aralashtirilmasdan, har biri
          o'z narxi/omborida alohida ko'rinadi. */}
      <Dialog open={!!viewingLots} onOpenChange={(o) => !o && setViewingLots(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" /> {viewingLots?.name} - partiyalar
            </DialogTitle>
          </DialogHeader>
          {viewingLots && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {lotsForProduct(viewingLots.id).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Faol partiya yo&apos;q
                </p>
              ) : (
                lotsForProduct(viewingLots.id).map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p>
                        {formatQuantity(lot.remainingQuantity, viewingLots.unit)} -{" "}
                        <span className="font-medium">{formatMoney(lot.unitCostUzs)}</span>
                        /birlik
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lot.warehouseName} -{" "}
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
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mahsulotni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleting?.name}&quot; mahsulotini o'chirmoqchimisiz? Yozuv butunlay o'chmaydi -
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
