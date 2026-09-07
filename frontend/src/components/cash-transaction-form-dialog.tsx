"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Partner } from "@/lib/types";

const schema = z.object({
  partnerId: z.string().optional(),
  amountUzs: z.string().min(1, "Summa kiritilishi shart"),
  note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Kassaga qo'lda kirim/chiqim yozish uchun (masalan egasi naqd pul qo'shdi
 * yoki kassadan shaxsiy ehtiyoj uchun naqd oldi) - savdo/xarajat bilan
 * bog'liq bo'lmagan holatlar uchun, har doim sharh (izoh) bilan.
 */
export function CashTransactionFormDialog({
  direction,
  open,
  onOpenChange,
}: {
  direction: "in" | "out";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { partnerId: "", amountUzs: "", note: "" },
  });

  useEffect(() => {
    if (open) reset({ partnerId: "", amountUzs: "", note: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/cash/transactions", {
        direction,
        partnerId: values.partnerId || null,
        amountUzs: Number(values.amountUzs),
        note: values.note,
      }),
    onSuccess: () => {
      toast.success(direction === "in" ? "Kassaga kirim qayd etildi" : "Kassadan chiqim qayd etildi");
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      // Hamkor tanlangan bo'lsa, uning balansi ham o'zgargan bo'lishi mumkin.
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {direction === "in" ? "Kassaga qo'lda kirim" : "Kassadan qo'lda chiqim"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label>Hamkor (ixtiyoriy)</Label>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="partnerId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={partners?.map((p) => ({ value: p.id, label: p.name })) ?? []}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Hamkor tanlanmagan" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Yangi hamkor qo'shish"
                onClick={() => setPartnerFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
                direction === "in" ? "Masalan: egasi naqd pul qo'shdi" : "Masalan: kassadan naqd olindi"
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

      {/* Hamkor ro'yxatida yo'q bo'lsa, shu yerdan chiqmasdan yangi hamkor
          qo'shish mumkin - qo'shilgach avtomatik tanlanadi. */}
      <PartnerFormDialog
        open={partnerFormOpen}
        onOpenChange={setPartnerFormOpen}
        onCreated={(p) => setValue("partnerId", p.id)}
      />
    </Dialog>
  );
}
