"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  amount: z.string().min(1, "Summa kiritilishi shart"),
  currency: z.enum(["UZS", "USD"]),
  method: z.enum(["cash", "card", "bank"]),
});

type FormValues = z.infer<typeof schema>;

export function PaymentFormDialog({
  partnerId,
  saleId,
  open,
  onOpenChange,
}: {
  partnerId: string;
  saleId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  // Backend "qolgan qarzdan oshib ketdi" desa - xabar shu yerda saqlanadi va
  // "Avans sifatida saqlash" tanlovi ko'rsatiladi.
  const [overpayMessage, setOverpayMessage] = useState<string | null>(null);
  const [allowOverpay, setAllowOverpay] = useState(false);
  const { handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", currency: "UZS", method: "cash" },
  });

  // Dialog ochilganda ortiqcha-to'lov holati tozalanadi. Bu render paytida
  // "oldingi qiymat bilan solishtirish" usulida qilinadi (effect ichida
  // setState chaqirish lint xatosi beradi va ortiqcha render keltiradi).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setOverpayMessage(null);
      setAllowOverpay(false);
    }
  }

  useEffect(() => {
    if (open) reset({ amount: "", currency: "UZS", method: "cash" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/payments", {
        partnerId,
        saleId: saleId ?? null,
        amount: Number(values.amount),
        currency: values.currency,
        method: values.method,
        // Faqat foydalanuvchi "avans" deb tasdiqlagandagina yuboriladi.
        ...(allowOverpay ? { allowOverpay: true } : {}),
      }),
    onSuccess: () => {
      toast.success("To'lov qayd etildi");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // To'lov kassa qatori va foyda/qarz kartalariga ham ta'sir qiladi.
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-report"] });
      queryClient.invalidateQueries({ queryKey: ["profit-report"] });
      onOpenChange(false);
    },
    onError: (err) => {
      // Ortiqcha to'lov: toast o'rniga formada xabar + avans tanlovi ko'rsatiladi.
      if (err instanceof ApiError && err.status === 400 && err.message.includes("oshib ketdi")) {
        setOverpayMessage(err.message);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>To'lov qo'shish</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Summa</Label>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    id="amount"
                    autoFocus
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      // Summa o'zgarsa, oldingi "ortiqcha to'lov" ogohlantirishi eskirdi.
                      setOverpayMessage(null);
                      setAllowOverpay(false);
                    }}
                  />
                )}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Valyuta</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={[
                      { value: "UZS", label: "So'm (UZS)" },
                      { value: "USD", label: "Dollar (USD)" },
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS">So'm (UZS)</SelectItem>
                      <SelectItem value="USD">Dollar (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>To'lov usuli</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={[
                    { value: "cash", label: "Naqd" },
                    { value: "card", label: "Karta" },
                    { value: "bank", label: "Bank o'tkazmasi" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Naqd</SelectItem>
                    <SelectItem value="card">Karta</SelectItem>
                    <SelectItem value="bank">Bank o'tkazmasi</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {overpayMessage && (
            <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <p className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{overpayMessage}</span>
              </p>
              <label className="flex cursor-pointer items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={allowOverpay}
                  onCheckedChange={(checked) => setAllowOverpay(checked === true)}
                />
                <span>
                  <span className="block font-medium">Avans sifatida saqlash</span>
                  <span className="block text-xs text-muted-foreground">
                    Ortiqcha summa hamkorning avansi (bizning unga qarzimiz) bo'lib qoladi
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || (!!overpayMessage && !allowOverpay)}>
              {mutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
