"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { MovementFormDialog } from "@/components/movement-form-dialog";
import { TransferFormDialog } from "@/components/transfer-form-dialog";
import { ExcelActions } from "@/components/excel-actions";
import { api } from "@/lib/api";
import type { StockMovement, Product, Warehouse } from "@/lib/types";
import { formatDateTime, formatMoney, formatQuantity, movementTypeLabels } from "@/lib/format";

export default function StockMovementsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<"in" | "out">("in");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["stock-movements", typeFilter, productFilter, warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (productFilter !== "all") params.set("productId", productFilter);
      if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
      const qs = params.toString();
      return api.get<StockMovement[]>(`/stock/movements${qs ? `?${qs}` : ""}`);
    },
  });

  const productName = (id: string) => products?.find((p) => p.id === id)?.name ?? "-";
  const productUnit = (id: string) => products?.find((p) => p.id === id)?.unit ?? "kg";
  const warehouseName = (id: string | null) =>
    id ? warehouses?.find((w) => w.id === id)?.name ?? "-" : "-";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kirim-chiqim</h1>
          <p className="text-sm text-muted-foreground">Ombor harakatlari tarixi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelActions
            exportPath="/excel/stock-movements/export"
            exportFileName="kirim-chiqim.xlsx"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDefaultType("in");
              setFormOpen(true);
            }}
          >
            <ArrowDownToLine className="h-4 w-4" />
            Kirim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDefaultType("out");
              setFormOpen(true);
            }}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Chiqim
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="h-4 w-4" />
            Transfer
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v ?? "all")}
          items={[
            { value: "all", label: "Barcha turlar" },
            { value: "in", label: "Kirim" },
            { value: "out", label: "Chiqim" },
          ]}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha turlar</SelectItem>
            <SelectItem value="in">Kirim</SelectItem>
            <SelectItem value="out">Chiqim</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={productFilter}
          onValueChange={(v) => setProductFilter(v ?? "all")}
          items={[
            { value: "all", label: "Barcha mahsulotlar" },
            ...(products?.map((p) => ({ value: p.id, label: p.name })) ?? []),
          ]}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Barcha mahsulotlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha mahsulotlar</SelectItem>
            {products?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={warehouseFilter}
          onValueChange={(v) => setWarehouseFilter(v ?? "all")}
          items={[
            { value: "all", label: "Barcha omborlar" },
            ...(warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []),
          ]}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Barcha omborlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha omborlar</SelectItem>
            {warehouses?.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Hozircha yozuv yo'q
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Turi</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Ombor</TableHead>
                  <TableHead>Mashina raqami</TableHead>
                  <TableHead>Miqdor</TableHead>
                  <TableHead>Narxi</TableHead>
                  <TableHead className="text-right">Umumiy</TableHead>
                  <TableHead>Izoh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDateTime(m.movementDate)}</TableCell>
                    <TableCell>
                      <Badge variant={m.type === "in" ? "default" : "secondary"}>
                        {movementTypeLabels[m.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{productName(m.productId)}</TableCell>
                    <TableCell>{warehouseName(m.warehouseId)}</TableCell>
                    <TableCell>{m.vehicleNumber ?? "-"}</TableCell>
                    <TableCell>{formatQuantity(m.quantity, productUnit(m.productId))}</TableCell>
                    <TableCell>
                      {m.pricePerUnit ? formatMoney(m.pricePerUnit, m.currency) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.pricePerUnit
                        ? formatMoney(Number(m.quantity) * Number(m.pricePerUnit), m.currency)
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {m.note ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {data.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{productName(m.productId)}</span>
                    <Badge variant={m.type === "in" ? "default" : "secondary"}>
                      {movementTypeLabels[m.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatQuantity(m.quantity, productUnit(m.productId))}</span>
                    <span>{m.pricePerUnit ? formatMoney(m.pricePerUnit, m.currency) : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(m.movementDate)}</span>
                    <span>
                      {[m.warehouseId ? warehouseName(m.warehouseId) : null, m.vehicleNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <MovementFormDialog open={formOpen} onOpenChange={setFormOpen} defaultType={defaultType} />
      <TransferFormDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
