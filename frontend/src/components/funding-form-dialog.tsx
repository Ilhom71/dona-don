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
  // Faqat method="bank" bo'lganda ma'noli - aynan qaysi bank hisob raqamiga/dan.
  bankAccount: z.string().optional(),
  note: z.string().min(1, "Sharh (izoh) kiritilishi shart"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Kassani to'ldirish uchun kiritiladigan pul ("Pul olib turish") yoki uni
 * qaytarish ("Pulni qaytarish") - hisobni to'g'ri boshlash yoki keyinroq
 * to'g'irlash uchun. Bu yozuv HECH QACHON hamkorga bog'lanmaydi, hamkor
 * qarziga ta'sir qilmaydi va foyda-zarar hisobotida ko'rinmaydi - faqat
 * kassa qoldig'ida ("Qozondagi pul") ko'rinadi.
 */
export function FundingFormDialog({
  direction,
  open,
  onOpenChange,
}: {
  direction: "in" | "out";
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
    defaultValues: { amountUzs: "", method: "cash", bankAccount: "", note: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ amountUzs: "", method: "cash", bankAccount: "", note: "" });
    }
  }, [open, reset]);

  const method = watch("method");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/cash/transactions", {
        direction,
        purpose: "funding",
        amountUzs: Number(values.amountUzs),
        method: values.method,
        bankAccount: values.method === "bank" ? values.bankAccount || null : null,
        note: values.note,
      }),
    onSuccess: () => {
      toast.success(
        direction === "in" ? "Pul olib turish qayd etildi" : "Pulni qaytarish qayd etildi"
      );
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
          <DialogTitle>{direction === "in" ? "Pul olib turish" : "Pulni qaytarish"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Bu pul kassaga qo&apos;shiladi (yoki kassadan chiqadi), hamkor qarziga
          yozilmaydi va foyda/zararga ta&apos;sir qilmaydi.
        </p>
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
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Sharh (izoh)</Label>
            <Textarea
              id="note"
              placeholder={
                direction === "in"
                  ? "Masalan: hisobni to'g'irlash uchun kassaga pul qo'shildi"
                  : "Masalan: oldin olib turilgan pul qaytarildi"
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
