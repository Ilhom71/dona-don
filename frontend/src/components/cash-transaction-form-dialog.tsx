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
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Partner } from "@/lib/types";
import { paymentMethodLabels } from "@/lib/format";

const methodItems = Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }));

const schema = z.object({
  partnerId: z.string().optional(),
  amountUzs: z.string().min(1, "Summa kiritilishi shart"),
  method: z.enum(["cash", "card", "bank"]),
  // Faqat method="bank" bo'lganda ma'noli - aynan qaysi bank hisob raqamiga/dan.
  bankAccount: z.string().optional(),
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
  title,
  initialPartnerId,
}: {
  direction: "in" | "out";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Ixtiyoriy sarlavha almashtirish (masalan "Hamkorga pul o'tkazish").
  title?: string;
  // Hamkor sahifasidan "Pul o'tkazish" bosilganda, o'sha hamkor oldindan
  // tanlangan holda ochiladi (baribir o'zgartirish mumkin).
  initialPartnerId?: string | null;
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
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { partnerId: "", amountUzs: "", method: "cash", bankAccount: "", note: "" },
  });

  useEffect(() => {
    if (open) {
      const initialPartner = partners?.find((p) => p.id === initialPartnerId);
      reset({
        partnerId: initialPartnerId ?? "",
        amountUzs: "",
        method: "cash",
        bankAccount: initialPartner?.bankAccount ?? "",
        note: "",
      });
    }
  }, [open, initialPartnerId, partners, reset]);

  const method = watch("method");

  // Hamkor tanlanganda (yoki o'zgartirilganda), agar uning saqlangan bank
  // hisob raqami bo'lsa - avtomatik taklif qilinadi (baribir qo'lda
  // o'zgartirish/o'chirish mumkin). Boshqa hamkorga o'tilsa va uning
  // raqami bo'lmasa, eski hamkorning raqami qolib ketmasligi uchun tozalanadi.
  function handlePartnerSelect(partnerId: string) {
    setValue("partnerId", partnerId);
    const selected = partners?.find((p) => p.id === partnerId);
    setValue("bankAccount", selected?.bankAccount ?? "");
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/cash/transactions", {
        direction,
        partnerId: values.partnerId || null,
        amountUzs: Number(values.amountUzs),
        method: values.method,
        bankAccount: values.method === "bank" ? values.bankAccount || null : null,
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
            {title ?? (direction === "in" ? "Kassaga qo'lda kirim" : "Kassadan qo'lda chiqim")}
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
                    onValueChange={(v) => v && handlePartnerSelect(v)}
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
              <Input
                id="bankAccount"
                placeholder="2020 8000 xxxx xxxx"
                {...register("bankAccount")}
              />
              <p className="text-xs text-muted-foreground">
                Hamkor tanlansa va uning saqlangan raqami bo&apos;lsa - avtomatik to&apos;ldiriladi,
                kerak bo&apos;lsa qo&apos;lda o&apos;zgartiring.
              </p>
            </div>
          )}
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
