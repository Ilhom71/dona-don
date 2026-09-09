"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api, ApiError } from "@/lib/api";
import type { Product, Warehouse } from "@/lib/types";
import { toDateInputValue } from "@/lib/format";

const schema = z
  .object({
    productId: z.string().uuid("Mahsulot tanlanishi shart"),
    fromWarehouseId: z.string().uuid("Manba ombor tanlanishi shart"),
    toWarehouseId: z.string().uuid("Maqsad ombor tanlanishi shart"),
    quantity: z.string().min(1, "Miqdor kiritilishi shart"),
    vehicleNumber: z.string().optional(),
    note: z.string().optional(),
    movementDate: z.string(),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: "Manba va maqsad ombor bir xil bo'lishi mumkin emas",
    path: ["toWarehouseId"],
  });

type FormValues = z.infer<typeof schema>;

export function TransferFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      productId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      quantity: "",
      vehicleNumber: "",
      note: "",
      movementDate: toDateInputValue(new Date()),
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        productId: "",
        fromWarehouseId: "",
        toWarehouseId: "",
        quantity: "",
        vehicleNumber: "",
        note: "",
        movementDate: toDateInputValue(new Date()),
      });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/stock/transfers", {
        productId: values.productId,
        fromWarehouseId: values.fromWarehouseId,
        toWarehouseId: values.toWarehouseId,
        quantity: Number(values.quantity),
        vehicleNumber: values.vehicleNumber || null,
        note: values.note || null,
        movementDate: new Date(values.movementDate).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Transfer amalga oshirildi");
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Omborlar orasida transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label>Mahsulot</Label>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={products?.map((p) => ({ value: p.id, label: p.name })) ?? []}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mahsulotni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.productId && (
              <p className="text-sm text-destructive">{errors.productId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Qaysi ombordan</Label>
              <Controller
                control={control}
                name="fromWarehouseId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Manba ombor" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fromWarehouseId && (
                <p className="text-sm text-destructive">{errors.fromWarehouseId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Qaysi omborga</Label>
              <Controller
                control={control}
                name="toWarehouseId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Maqsad ombor" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.toWarehouseId && (
                <p className="text-sm text-destructive">{errors.toWarehouseId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Miqdor</Label>
              <Input id="quantity" type="number" step="any" {...register("quantity")} />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="movementDate">Sana</Label>
              <Input id="movementDate" type="date" {...register("movementDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleNumber">Mashina raqami (ixtiyoriy)</Label>
            <Input id="vehicleNumber" placeholder="01 A 123 BC" {...register("vehicleNumber")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Izoh</Label>
            <Textarea id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saqlanmoqda..." : "Transfer qilish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
