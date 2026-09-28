"use client";

import { useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { paymentMethodLabels } from "@/lib/format";

const methodItems = Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }));

const schema = z.object({
  amountUzs: z.string().min(1, "Summa kiritilishi shart"),
  method: z.enum(["cash", "card", "bank"]),
  bankAccount: z.string().optional(),
  note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Buxgalteriya (joriy hisob) bilan bog'liq ikki amal uchun bitta forma:
 *  - "transfer" - kassadan buxgalteriyaga o'tkazma (kassa qoldig'ini kamaytiradi,
 *    buxgalteriya qoldig'ini oshiradi)
 *  - "withdraw" - buxgalteriyadan pul chiqarish (faqat buxgalteriya qoldig'iga
 *    ta'sir qiladi, kassaga tegmaydi)
 */
export function AccountingTransactionFormDialog({
  mode,
  defaultMethod = "cash",
  open,
  onOpenChange,
}: {
  mode: "transfer" | "withdraw";
  defaultMethod?: "cash" | "card" | "bank";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amountUzs: "", method: defaultMethod, bankAccount: "", note: "" },
  });

  useEffect(() => {
    if (open) reset({ amountUzs: "", method: defaultMethod, bankAccount: "", note: "" });
  }, [open, defaultMethod, reset]);

  const method = watch("method");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(mode === "transfer" ? "/cash/accounting/transfer-in" : "/cash/accounting/withdraw", {
        amountUzs: Number(values.amountUzs),
        ...(mode === "withdraw"
          ? {
              method: values.method,
              bankAccount: values.method === "bank" ? values.bankAccount || null : null,
            }
          : {}),
        note: values.note,
      }),
    onSuccess: () => {
      toast.success(
        mode === "transfer"
          ? "Kassadan o'tkazildi"
          : defaultMethod === "bank"
            ? "Bank orqali o'tkazildi"
            : "Pul chiqarildi"
      );
      // Ikkalasi ham o'zgarishi mumkin: transfer kassa qoldig'ini ham kamaytiradi.
      queryClient.invalidateQueries({ queryKey: ["accounting-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "transfer"
              ? "Kassadan buxgalteriyaga o'tkazish"
              : defaultMethod === "bank"
                ? "Bank orqali pul o'tkazish"
                : "Buxgalteriyadan pul chiqarish"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amountUzs">Summa (so&apos;m)</Label>
            <Controller
              control={control}
              name="amountUzs"
              render={({ field }) => (
                <MoneyInput id="amountUzs" autoFocus value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.amountUzs && (
              <p className="text-sm text-destructive">{errors.amountUzs.message}</p>
            )}
          </div>
          {mode === "withdraw" && (
            <>
              <div className="space-y-2">
                <Label>To&apos;lov usuli</Label>
                <Controller
                  control={control}
                  name="method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={methodItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {methodItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {method === "bank" && (
                <div className="space-y-2">
                  <Label htmlFor="bankAccount">Bank hisob raqami</Label>
                  <Input id="bankAccount" placeholder="2020 8000 xxxx xxxx" {...register("bankAccount")} />
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Sharh (izoh)</Label>
            <Textarea
              id="note"
              placeholder={
                mode === "transfer"
                  ? "Masalan: haftalik tushumni joriy hisobga o'tkazish"
                  : defaultMethod === "bank"
                    ? "Masalan: yetkazib beruvchiga bank orqali to'lov"
                    : "Masalan: egasi joriy hisobdan mablag' oldi"
              }
              {...register("note")}
            />
            {errors.note && <p className="text-sm text-destructive">{errors.note.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
