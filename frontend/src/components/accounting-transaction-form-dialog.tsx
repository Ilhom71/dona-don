"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  amountUzs: z.string().min(1, "Summa kiritilishi shart"),
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
  open,
  onOpenChange,
}: {
  mode: "transfer" | "withdraw";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amountUzs: "", note: "" },
  });

  useEffect(() => {
    if (open) reset({ amountUzs: "", note: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(mode === "transfer" ? "/cash/accounting/transfer-in" : "/cash/accounting/withdraw", {
        amountUzs: Number(values.amountUzs),
        note: values.note,
      }),
    onSuccess: () => {
      toast.success(mode === "transfer" ? "Kassadan o'tkazildi" : "Pul chiqarildi");
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
            {mode === "transfer" ? "Kassadan buxgalteriyaga o'tkazish" : "Buxgalteriyadan pul chiqarish"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amountUzs">Summa (so&apos;m)</Label>
            <Input id="amountUzs" type="number" step="any" autoFocus {...register("amountUzs")} />
            {errors.amountUzs && (
              <p className="text-sm text-destructive">{errors.amountUzs.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Sharh (izoh)</Label>
            <Textarea
              id="note"
              placeholder={
                mode === "transfer"
                  ? "Masalan: haftalik tushumni joriy hisobga o'tkazish"
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
