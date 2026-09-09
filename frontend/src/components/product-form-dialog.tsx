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
import type { Product } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Nomi kiritilishi shart"),
  unit: z.enum(["kg", "ton"]),
  minStockAlert: z.string().optional(),
  sellingPriceUzs: z.string().optional(),
  avgCostUzs: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProductFormDialog({
  product,
  open,
  onOpenChange,
}: {
  product?: Product | null;
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      unit: "kg",
      minStockAlert: "",
      sellingPriceUzs: "",
      avgCostUzs: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: product?.name ?? "",
        unit: product?.unit ?? "kg",
        minStockAlert: product?.minStockAlert ?? "",
        sellingPriceUzs: product?.sellingPriceUzs ?? "",
        avgCostUzs: product?.avgCostUzs ?? "",
        notes: product?.notes ?? "",
      });
    }
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        unit: values.unit,
        minStockAlert: values.minStockAlert ? values.minStockAlert : null,
        sellingPriceUzs: values.sellingPriceUzs ? values.sellingPriceUzs : null,
        // Faqat tahrirlashda va qiymat kiritilgan bo'lsa yuboriladi - yangi
        // mahsulot doim 0 tan narx bilan boshlanadi (kirim orqali hisoblanadi).
        avgCostUzs: product && values.avgCostUzs ? values.avgCostUzs : undefined,
        notes: values.notes ? values.notes : null,
      };
      return product
        ? api.put(`/products/${product.id}`, payload)
        : api.post("/products", payload);
    },
    onSuccess: () => {
      toast.success(product ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nomi</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>O'lchov birligi</Label>
            <Select
              value={watch("unit")}
              onValueChange={(v) => setValue("unit", v as "kg" | "ton")}
              items={[
                { value: "kg", label: "Kilogramm (kg)" },
                { value: "ton", label: "Tonna (t)" },
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogramm (kg)</SelectItem>
                <SelectItem value="ton">Tonna (t)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sellingPriceUzs">Sotuv narxi (so'm)</Label>
              <Controller
                control={control}
                name="sellingPriceUzs"
                render={({ field }) => (
                  <MoneyInput
                    id="sellingPriceUzs"
                    placeholder="1 birlik uchun"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockAlert">Kam qolish chegarasi</Label>
              <Input id="minStockAlert" type="number" step="any" {...register("minStockAlert")} />
            </div>
          </div>
          {product && (
            <div className="space-y-2">
              <Label htmlFor="avgCostUzs">Tan narx (so&apos;m, barcha omborlar uchun)</Label>
              <Controller
                control={control}
                name="avgCostUzs"
                render={({ field }) => (
                  <MoneyInput id="avgCostUzs" value={field.value} onChange={field.onChange} />
                )}
              />
              <p className="text-xs text-muted-foreground">
                Odatda kirim orqali avtomatik hisoblanadi - faqat xato bo&apos;lganda qo&apos;lda
                tuzatish uchun.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Izoh</Label>
            <Textarea id="notes" {...register("notes")} />
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
