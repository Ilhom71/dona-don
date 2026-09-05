"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import type { ProductStock, Product, Warehouse } from "@/lib/types";
import { formatMoney, formatQuantity } from "@/lib/format";

export default function StockLevelsPage() {
  const [productFilter, setProductFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["stock-levels", productFilter, warehouseFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productFilter !== "all") params.set("productId", productFilter);
      if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
      const qs = params.toString();
      return api.get<ProductStock[]>(`/stock/levels${qs ? `?${qs}` : ""}`);
    },
  });

  const visible = (data ?? []).filter((s) => Number(s.quantity) > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Qoldiqlar</h1>
        <p className="text-sm text-muted-foreground">
          Qaysi omborda qanday mahsulot va qancha qoldiq borligi
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Boxes className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Hozircha qoldiq yo'q</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead>Ombor</TableHead>
                  <TableHead>Qoldiq</TableHead>
                  <TableHead>Tan narx</TableHead>
                  <TableHead className="text-right">Jami qiymat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.product?.name ?? "-"}</TableCell>
                    <TableCell>{s.warehouse?.name ?? "-"}</TableCell>
                    <TableCell>
                      {formatQuantity(s.quantity, s.product?.unit ?? "kg")}
                    </TableCell>
                    <TableCell>{formatMoney(s.avgCostUzs)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(s.quantity) * Number(s.avgCostUzs))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {visible.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.product?.name ?? "-"}</span>
                    <span className="text-sm text-muted-foreground">{s.warehouse?.name ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatQuantity(s.quantity, s.product?.unit ?? "kg")}</span>
                    <span>{formatMoney(s.avgCostUzs)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
