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
import type { Partner } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Nomi kiritilishi shart"),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["customer", "supplier", "both"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function PartnerFormDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner?: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", address: "", type: "customer", notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: partner?.name ?? "",
        phone: partner?.phone ?? "",
        address: partner?.address ?? "",
        type: partner?.type ?? "customer",
        notes: partner?.notes ?? "",
      });
    }
  }, [open, partner, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone || null,
        address: values.address || null,
        type: values.type,
        notes: values.notes || null,
      };
      return partner
        ? api.put(`/partners/${partner.id}`, payload)
        : api.post("/partners", payload);
    },
    onSuccess: () => {
      toast.success(partner ? "Hamkor yangilandi" : "Hamkor qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{partner ? "Hamkorni tahrirlash" : "Yangi hamkor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ismi / nomi</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Turi</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={[
                    { value: "customer", label: "Mijoz" },
                    { value: "supplier", label: "Yetkazib beruvchi" },
                    { value: "both", label: "Mijoz va yetkazib beruvchi" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Mijoz</SelectItem>
                    <SelectItem value="supplier">Yetkazib beruvchi</SelectItem>
                    <SelectItem value="both">Mijoz va yetkazib beruvchi</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" {...register("phone")} placeholder="+998 90 123 45 67" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Manzil</Label>
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
