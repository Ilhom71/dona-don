"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

type RateHistoryItem = { id: string; rate: string; createdAt: string };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newRate, setNewRate] = useState("");

  const { data: current, isLoading } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => api.get<{ rate: number | null }>("/settings/exchange-rate"),
  });

  const { data: history } = useQuery({
    queryKey: ["exchange-rate-history"],
    queryFn: () => api.get<RateHistoryItem[]>("/settings/exchange-rate/history"),
  });

  const mutation = useMutation({
    mutationFn: (rate: number) => api.post("/settings/exchange-rate", { rate }),
    onSuccess: () => {
      toast.success("Valyuta kursi yangilandi");
      setNewRate("");
      queryClient.invalidateQueries({ queryKey: ["exchange-rate"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-history"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sozlamalar</h1>
        <p className="text-sm text-muted-foreground">Valyuta kursi va tizim sozlamalari</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            USD / UZS kursi
          </CardTitle>
          <CardDescription>
            Barcha savdo va kirim-chiqim operatsiyalarida shu kurs ishlatiladi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <p className="text-3xl font-semibold">
              {current?.rate ? `${formatMoney(current.rate)}` : "Kiritilmagan"}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newRate) mutation.mutate(Number(newRate));
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="rate">Yangi kurs (1 USD = ? so'm)</Label>
              <Input
                id="rate"
                type="number"
                step="any"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="12700"
              />
            </div>
            <Button type="submit" disabled={mutation.isPending || !newRate}>
              {mutation.isPending ? "Saqlanmoqda..." : "Yangilash"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Kurs tarixi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tarix mavjud emas</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span>{formatMoney(h.rate)}</span>
                  <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
