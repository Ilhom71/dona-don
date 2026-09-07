"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeftRight,
  Ban,
  Package,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import type {
  CashLedgerRow,
  Product,
  Partner,
  Purchase,
  Sale,
  StockMovement,
  Warehouse,
} from "@/lib/types";
import {
  cashDirectionLabels,
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
  movementTypeLabels,
  partnerTypeLabels,
  unitLabels,
} from "@/lib/format";

// Kelib chiqqan jadvaliga qarab to'g'ri "tiklash" endpointini tanlaydi.
function restorePathFor(row: CashLedgerRow) {
  if (row.source === "payment") return `/payments/${row.id}/restore`;
  if (row.source === "expense") return `/expenses/${row.id}/restore`;
  return `/cash/transactions/${row.id}/restore`;
}

/**
 * "O'chirish" bosilgan mahsulot/hamkor/ombor yozuvlari haqiqatda o'chirilmaydi -
 * shu yerga (arxiv) o'tadi va istalgan vaqt "Tiklash" bilan qaytariladi.
 * Tarixiy savdo/xarid/kirim-chiqim yozuvlari bunga bog'liq bo'lgani uchun
 * (immutable ledger) yozuvning o'zi butunlay o'chirilmaydi.
 */
export default function ArchivePage() {
  const queryClient = useQueryClient();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["archived-products"],
    queryFn: () => api.get<Product[]>("/products/archived"),
  });
  const { data: partners, isLoading: partnersLoading } = useQuery({
    queryKey: ["archived-partners"],
    queryFn: () => api.get<Partner[]>("/partners/archived"),
  });
  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ["archived-warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses/archived"),
  });
  const { data: cancelledSales, isLoading: cancelledSalesLoading } = useQuery({
    queryKey: ["cancelled-sales"],
    queryFn: () => api.get<Sale[]>("/sales?paymentStatus=cancelled"),
  });
  const { data: fullLedger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["cash-ledger-full"],
    queryFn: () => api.get<CashLedgerRow[]>("/cash/ledger"),
  });
  const cancelledCashOps = (fullLedger ?? []).filter((r) => r.cancelled);
  const { data: fullAccountingLedger, isLoading: accountingLedgerLoading } = useQuery({
    queryKey: ["accounting-ledger-full"],
    queryFn: () => api.get<CashLedgerRow[]>("/cash/accounting/ledger"),
  });
  const cancelledAccountingOps = (fullAccountingLedger ?? []).filter((r) => r.cancelled);
  const { data: cancelledPurchases, isLoading: cancelledPurchasesLoading } = useQuery({
    queryKey: ["cancelled-purchases"],
    queryFn: () => api.get<Purchase[]>("/purchases?paymentStatus=cancelled"),
  });
  const { data: allMovements, isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements-full"],
    queryFn: () => api.get<StockMovement[]>("/stock/movements"),
  });
  const { data: allProducts } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const productUnit = (id: string) => allProducts?.find((p) => p.id === id)?.unit ?? "kg";
  // Faqat "manual" (qo'lda kiritilgan) yozuvlar tiklanadi - "purchase" manbali
  // yozuvlar bog'liq xarid orqali (u yerda faqat ko'rish, tiklanmaydi) hisobga olinadi.
  const cancelledMovements = (allMovements ?? []).filter(
    (m) => m.cancelled && m.source === "manual"
  );

  function useRestore(path: string, invalidateKeys: string[]) {
    return useMutation({
      mutationFn: (id: string) => api.post(`${path}/${id}/restore`, {}),
      onSuccess: () => {
        toast.success("Tiklandi");
        for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: [key] });
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
    });
  }

  const restoreProduct = useRestore("/products", [
    "archived-products",
    "products",
    "stock-levels",
    "dashboard",
  ]);
  const restorePartner = useRestore("/partners", ["archived-partners", "partners"]);
  const restoreWarehouse = useRestore("/warehouses", ["archived-warehouses", "warehouses"]);

  const restoreCashOpMutation = useMutation({
    mutationFn: (row: CashLedgerRow) => api.post(restorePathFor(row), {}),
    onSuccess: () => {
      toast.success("Tiklandi");
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-full"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      // Tiklangan yozuv kassa->buxgalteriya o'tkazmaning bir tomoni bo'lishi
      // mumkin - bunda ikkinchi tomon (buxgalteriya) ham serverda avtomatik
      // tiklanadi, shuning uchun u yerni ham yangilaymiz.
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger-full"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-report"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  // Buxgalteriya (joriy hisob) yozuvlari ham xuddi shu jadval/endpointdan
  // tiklanadi (`cash_transactions`) - kassaniki bilan bir xil, faqat manba
  // "/cash/accounting/ledger".
  const restoreAccountingOpMutation = useMutation({
    mutationFn: (row: CashLedgerRow) => api.post(`/cash/transactions/${row.id}/restore`, {}),
    onSuccess: () => {
      toast.success("Tiklandi");
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger-full"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      // Tiklangan yozuv kassa tomonini ham qamrab olishi mumkin (yuqoridagi
      // izohga qarang) - shuning uchun kassa so'rovlarini ham yangilaymiz.
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-full"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  const restoreMovementMutation = useMutation({
    mutationFn: (m: StockMovement) => api.post(`/stock/movements/${m.id}/restore`, {}),
    onSuccess: () => {
      toast.success("Tiklandi");
      queryClient.invalidateQueries({ queryKey: ["stock-movements-full"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  const isEmpty =
    !productsLoading &&
    !partnersLoading &&
    !warehousesLoading &&
    !cancelledSalesLoading &&
    !cancelledPurchasesLoading &&
    !ledgerLoading &&
    !movementsLoading &&
    !products?.length &&
    !partners?.length &&
    !warehouses?.length &&
    !cancelledSales?.length &&
    !cancelledPurchases?.length &&
    !cancelledCashOps.length &&
    !cancelledMovements.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Arxiv</h1>
        <p className="text-sm text-muted-foreground">
          O&apos;chirilgan mahsulot, hamkor va omborlar - istalgan vaqt tiklash mumkin
        </p>
      </div>

      {isEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Archive className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Arxiv bo&apos;sh</p>
          </CardContent>
        </Card>
      )}

      {(productsLoading || !!products?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Mahsulotlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomi</TableHead>
                      <TableHead>Birlik</TableHead>
                      <TableHead>Arxivlangan sana</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{unitLabels[p.unit]}</TableCell>
                        <TableCell>{p.archivedAt ? formatDate(p.archivedAt) : "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreProduct.mutate(p.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(partnersLoading || !!partners?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Hamkorlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partnersLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ismi / nomi</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead>Arxivlangan sana</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{partnerTypeLabels[p.type]}</TableCell>
                        <TableCell>{p.archivedAt ? formatDate(p.archivedAt) : "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restorePartner.mutate(p.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(warehousesLoading || !!warehouses?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WarehouseIcon className="h-4 w-4" /> Omborlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {warehousesLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomi</TableHead>
                      <TableHead>Manzili</TableHead>
                      <TableHead>Arxivlangan sana</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses?.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>{w.address ?? "-"}</TableCell>
                        <TableCell>{w.archivedAt ? formatDate(w.archivedAt) : "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreWarehouse.mutate(w.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(cancelledSalesLoading || !!cancelledSales?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Bekor qilingan savdolar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cancelledSalesLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Hamkor</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Sabab</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledSales?.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.saleDate)}</TableCell>
                        <TableCell className="font-medium">{s.partner?.name ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(s.totalAmountUzs)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.cancelReason ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Bekor qilingan savdolar tiklanmaydi (ombor bilan bog'liq bo'lgani uchun) - faqat
              audit uchun ko&apos;rinadi.
            </p>
          </CardContent>
        </Card>
      )}

      {(cancelledPurchasesLoading || !!cancelledPurchases?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" /> Bekor qilingan xaridlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cancelledPurchasesLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Hamkor</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Sabab</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledPurchases?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.purchaseDate)}</TableCell>
                        <TableCell className="font-medium">{p.partner?.name ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(p.totalAmountUzs)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.cancelReason ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Bekor qilingan xaridlar tiklanmaydi (ombor bilan bog'liq bo'lgani uchun) - faqat
              audit uchun ko&apos;rinadi.
            </p>
          </CardContent>
        </Card>
      )}

      {(movementsLoading || !!cancelledMovements.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="h-4 w-4" /> Bekor qilingan ombor amaliyotlari
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movementsLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Turi</TableHead>
                      <TableHead>Miqdor</TableHead>
                      <TableHead>Izoh</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{formatDateTime(m.movementDate)}</TableCell>
                        <TableCell>
                          <Badge variant={m.type === "in" ? "default" : "secondary"}>
                            {movementTypeLabels[m.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatQuantity(m.quantity, productUnit(m.productId))}</TableCell>
                        <TableCell className="text-muted-foreground">{m.note ?? "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreMovementMutation.mutate(m)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(ledgerLoading || !!cancelledCashOps.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Bekor qilingan kassa amaliyotlari
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Yo&apos;nalish</TableHead>
                      <TableHead>Tavsif</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledCashOps.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDateTime(r.date)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                            {cashDirectionLabels[r.direction]}
                          </span>
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell className="text-right">{formatMoney(r.amountUzs)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreCashOpMutation.mutate(r)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(accountingLedgerLoading || !!cancelledAccountingOps.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Bekor qilingan buxgalteriya amaliyotlari
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accountingLedgerLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Yo&apos;nalish</TableHead>
                      <TableHead>Tavsif</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledAccountingOps.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDateTime(r.date)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                            {cashDirectionLabels[r.direction]}
                          </span>
                        </TableCell>
                        <TableCell>{r.description}</TableCell>
                        <TableCell className="text-right">{formatMoney(r.amountUzs)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreAccountingOpMutation.mutate(r)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Tiklash
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
