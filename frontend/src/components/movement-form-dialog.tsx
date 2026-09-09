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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Product, Partner, Warehouse } from "@/lib/types";
import { toDateInputValue } from "@/lib/format";

const schema = z.object({
  type: z.enum(["in", "out"]),
  productId: z.string().uuid("Mahsulot tanlanishi shart"),
  quantity: z.string().min(1, "Miqdor kiritilishi shart"),
  pricePerUnit: z.string().optional(),
  currency: z.enum(["UZS", "USD"]),
  partnerId: z.string().optional(),
  warehouseId: z.string().uuid("Ombor tanlanishi shart"),
  vehicleNumber: z.string().optional(),
  note: z.string().optional(),
  movementDate: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function MovementFormDialog({
  open,
  onOpenChange,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "in" | "out";
}) {
  const queryClient = useQueryClient();
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        type: defaultType ?? "in",
        productId: "",
        quantity: "",
        pricePerUnit: "",
        currency: "UZS",
        partnerId: "",
        warehouseId: "",
        vehicleNumber: "",
        note: "",
        movementDate: toDateInputValue(new Date()),
      },
    });

  const type = watch("type");

  useEffect(() => {
    if (open) {
      reset({
        type: defaultType ?? "in",
        productId: "",
        quantity: "",
        pricePerUnit: "",
        currency: "UZS",
        partnerId: "",
        warehouseId: "",
        vehicleNumber: "",
        note: "",
        movementDate: toDateInputValue(new Date()),
      });
    }
  }, [open, defaultType, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/stock/movements", {
        productId: values.productId,
        type: values.type,
        quantity: Number(values.quantity),
        pricePerUnit: values.pricePerUnit ? Number(values.pricePerUnit) : null,
        currency: values.currency,
        partnerId: values.partnerId || null,
        warehouseId: values.warehouseId || null,
        vehicleNumber: values.vehicleNumber || null,
        note: values.note || null,
        movementDate: new Date(values.movementDate).toISOString(),
      }),
    onSuccess: () => {
      toast.success(type === "in" ? "Kirim qo'shildi" : "Chiqim qo'shildi");
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
          <DialogTitle>Ombor operatsiyasi</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={field.onChange}>
                <TabsList className="w-full">
                  <TabsTrigger value="in" className="flex-1">Kirim</TabsTrigger>
                  <TabsTrigger value="out" className="flex-1">Chiqim</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />

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

          <div className="space-y-2">
            <Label>Ombor</Label>
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Omborni tanlang" />
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
            {errors.warehouseId && (
              <p className="text-sm text-destructive">{errors.warehouseId.message}</p>
            )}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pricePerUnit">
                Narxi (birlik uchun) {type === "out" && "- ixtiyoriy"}
              </Label>
              <Controller
                control={control}
                name="pricePerUnit"
                render={({ field }) => (
                  <MoneyInput id="pricePerUnit" value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Valyuta</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={[
                      { value: "UZS", label: "So'm (UZS)" },
                      { value: "USD", label: "Dollar (USD)" },
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UZS">So'm (UZS)</SelectItem>
                      <SelectItem value="USD">Dollar (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {type === "in" && (
            <div className="space-y-2">
              <Label>Yetkazib beruvchi (ixtiyoriy)</Label>
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
                        <SelectValue placeholder="Hamkorni tanlang" />
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
          )}

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
              {mutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Ro'yxatda yo'q yangi yetkazib beruvchi bo'lsa, shu yerdan
          chiqmasdan qo'shish mumkin - qo'shilgach avtomatik tanlanadi. */}
      <PartnerFormDialog
        open={partnerFormOpen}
        onOpenChange={setPartnerFormOpen}
        onCreated={(p) => setValue("partnerId", p.id)}
      />
    </Dialog>
  );
}
