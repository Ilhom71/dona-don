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
import type { Unit } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { formatQuantity } from "@/lib/format";

const schema = z.object({
  actualQuantity: z.string().min(1, "Haqiqiy miqdorni kiriting"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Inventarizatsiya: mahsulotning haqiqiy (fizik hisoblangan) miqdorini
 * kiritish orqali qoldiqni to'g'irlaydi - kirim/chiqim shaklini to'ldirish
 * shart emas. Orqa fonda farq (yangi - hozirgi) miqdoricha oddiy kirim yoki
 * chiqim yozuvi (source: "manual") yaratiladi, shuning uchun bu ham
 * boshqa qo'lda yozuvlar kabi keyinroq bekor qilinishi/tiklanishi mumkin.
 */
export function StockAdjustmentDialog({
  productId,
  warehouseId,
  productName,
  unit,
  currentQuantity,
  open,
  onOpenChange,
}: {
  productId: string;
  warehouseId: string;
  productName: string;
  unit: Unit;
  currentQuantity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { actualQuantity: "" },
  });

  useEffect(() => {
    if (open) reset({ actualQuantity: String(currentQuantity) });
  }, [open, currentQuantity, reset]);

  const actualQuantity = watch("actualQuantity");
  const diff = Number(actualQuantity) - currentQuantity;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const newQty = Number(values.actualQuantity);
      const delta = newQty - currentQuantity;
      if (delta === 0) throw new Error("Miqdor o'zgarmadi");
      return api.post("/stock/movements", {
        productId,
        warehouseId,
        type: delta > 0 ? "in" : "out",
        quantity: Math.abs(delta),
        currency: "UZS",
        note: `Inventarizatsiya: miqdor to'g'irlandi (${formatQuantity(currentQuantity, unit)} → ${formatQuantity(newQty, unit)})`,
      });
    },
    onSuccess: () => {
      toast.success("Miqdor to'g'irlandi");
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Miqdorni to&apos;g&apos;irlash</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{productName}</p>
            <p className="text-sm text-muted-foreground">
              Hozirgi qoldiq: <span className="font-medium">{formatQuantity(currentQuantity, unit)}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualQuantity">
              Haqiqiy miqdor ({unit === "ton" ? "tonna" : "kg"})
            </Label>
            <Input
              id="actualQuantity"
              type="number"
              step="any"
              autoFocus
              {...register("actualQuantity")}
            />
            {errors.actualQuantity && (
              <p className="text-sm text-destructive">{errors.actualQuantity.message}</p>
            )}
            {!!actualQuantity && diff !== 0 && (
              <p className={`text-sm ${diff > 0 ? "text-emerald-600" : "text-destructive"}`}>
                {diff > 0 ? "+" : ""}
                {formatQuantity(diff, unit)} ({diff > 0 ? "kirim" : "chiqim"} sifatida yoziladi)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || diff === 0}>
              {mutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
