"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Truck } from "lucide-react";
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
import { ExcelActions } from "@/components/excel-actions";
import { api } from "@/lib/api";
import type { Partner, Sale, PaymentStatus } from "@/lib/types";
import { formatDate, formatMoney, paymentStatusLabels } from "@/lib/format";

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  paid: "default",
  partial: "secondary",
  credit: "destructive",
};

export default function SalesHistoryPage() {
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sales", partnerFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (partnerFilter !== "all") params.set("partnerId", partnerFilter);
      if (statusFilter !== "all") params.set("paymentStatus", statusFilter);
      const qs = params.toString();
      return api.get<Sale[]>(`/sales${qs ? `?${qs}` : ""}`);
    },
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
                  <TableHead>Sana</TableHead>
                  <TableHead>Hamkor</TableHead>
                  <TableHead>Mashina raqami</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead>To'langan</TableHead>
                  <TableHead>Holati</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/savdo/tarix/${s.id}`} className="block">
                        {formatDate(s.saleDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/savdo/tarix/${s.id}`} className="block font-medium">
                        {s.partner?.name ?? "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{s.vehicleNumber ?? "-"}</TableCell>
                    <TableCell>{formatMoney(s.totalAmount, s.currency)}</TableCell>
                    <TableCell>{formatMoney(s.paidAmountUzs)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.paymentStatus]}>
                        {paymentStatusLabels[s.paymentStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-3 md:hidden">
            {data.map((s) => (
              <Link key={s.id} href={`/savdo/tarix/${s.id}`}>
                <Card>
                  <CardContent className="space-y-2 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{s.partner?.name ?? "-"}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(s.saleDate)}</p>
                      </div>
                      <Badge variant={statusVariant[s.paymentStatus]}>
                        {paymentStatusLabels[s.paymentStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      {s.vehicleNumber ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Truck className="h-3.5 w-3.5" /> {s.vehicleNumber}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="font-medium">{formatMoney(s.totalAmount, s.currency)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
