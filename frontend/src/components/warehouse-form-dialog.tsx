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
import type { Warehouse } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Nomi kiritilishi shart"),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function WarehouseFormDialog({
  warehouse,
  open,
  onOpenChange,
}: {
  warehouse?: Warehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", address: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: warehouse?.name ?? "",
        address: warehouse?.address ?? "",
        notes: warehouse?.notes ?? "",
      });
    }
  }, [open, warehouse, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        address: values.address || null,
        notes: values.notes || null,
      };
      return warehouse
        ? api.put(`/warehouses/${warehouse.id}`, payload)
        : api.post("/warehouses", payload);
    },
    onSuccess: () => {
      toast.success(warehouse ? "Ombor yangilandi" : "Ombor qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warehouse ? "Omborni tahrirlash" : "Yangi ombor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nomi</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Manzili</Label>
            <Input id="address" {...register("address")} />
          </div>
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
