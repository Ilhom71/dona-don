"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Partner, Product, Purchase, Warehouse } from "@/lib/types";
import { formatMoney, toDateInputValue } from "@/lib/format";

const itemSchema = z.object({
  productId: z.string().uuid("Mahsulot tanlang"),
  quantity: z.string().min(1, "Miqdor kiritilishi shart"),
  unitPrice: z.string().min(1, "Narx kiritilishi shart"),
  // yuk puli (tashish xarajati) - ixtiyoriy, doim so'mda kiritiladi
  freightCostUzs: z.string().optional(),
});

const schema = z.object({
  partnerId: z.string().uuid("Hamkor tanlang"),
  warehouseId: z.string().uuid("Ombor tanlang"),
  vehicleNumber: z.string().optional(),
  purchaseDate: z.string(),
  currency: z.enum(["UZS", "USD"]),
  items: z.array(itemSchema).min(1, "Kamida bitta mahsulot qo'shing"),
  initialPayment: z.string().optional(),
  paymentMethod: z.enum(["cash", "card", "bank"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewPurchasePage() {
  return (
    <Suspense fallback={null}>
      <NewPurchaseForm />
    </Suspense>
  );
}

function NewPurchaseForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialWarehouseId = searchParams.get("warehouseId") ?? "";
  const initialPartnerId = searchParams.get("partnerId") ?? "";
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partnerId: initialPartnerId,
      warehouseId: initialWarehouseId,
      vehicleNumber: "",
      purchaseDate: toDateInputValue(new Date()),
      currency: "UZS",
      items: [{ productId: "", quantity: "", unitPrice: "", freightCostUzs: "" }],
      initialPayment: "",
      paymentMethod: "cash",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const currency = watch("currency");

  // Faqat bitta ombor bo'lsa, avtomatik tanlab qo'yamiz.
  useEffect(() => {
    if (!initialWarehouseId && warehouses?.length === 1) {
      setValue("warehouseId", warehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  // Barcha qatorlar bo'yicha yuk puli yig'indisi (doim so'mda, hisobot uchun)
  const freightTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.freightCostUzs) || 0), 0);
  }, [items]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Purchase>("/purchases", {
        partnerId: values.partnerId,
        warehouseId: values.warehouseId,
        vehicleNumber: values.vehicleNumber || null,
        purchaseDate: new Date(values.purchaseDate).toISOString(),
        currency: values.currency,
        items: values.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          freightCostUzs: i.freightCostUzs ? Number(i.freightCostUzs) : null,
        })),
        initialPayment: values.initialPayment ? Number(values.initialPayment) : null,
        paymentMethod: values.paymentMethod,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      toast.success("Xarid (kirim) muvaffaqiyatli saqlandi");
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      router.push("/ombor/kirim-chiqim");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Yangi kirim (xarid)</h1>
        <p className="text-sm text-muted-foreground">Yetkazib beruvchidan don sotib olish</p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Umumiy ma&apos;lumot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hamkor (yetkazib beruvchi)</Label>
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
              {errors.partnerId && (
                <p className="text-sm text-destructive">{errors.partnerId.message}</p>
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

            <div className="space-y-2">
              <Label htmlFor="vehicleNumber" className="flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" /> Mashina raqami
              </Label>
              <Input id="vehicleNumber" placeholder="01 A 123 BC" {...register("vehicleNumber")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Sana</Label>
              <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Mahsulotlar</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                append({ productId: "", quantity: "", unitPrice: "", freightCostUzs: "" })
              }
            >
              <Plus className="h-4 w-4" />
              Qator qo'shish
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.items?.root && (
              <p className="text-sm text-destructive">{errors.items.root.message}</p>
            )}
            {fields.map((field, index) => {
              const selectedProduct = products?.find((p) => p.id === items[index]?.productId);
              const qty = Number(items[index]?.quantity) || 0;
              const price = Number(items[index]?.unitPrice) || 0;
              return (
                <div key={field.id} className="rounded-md border p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label>Mahsulot</Label>
                      <Controller
                        control={control}
                        name={`items.${index}.productId`}
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
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>
                        Miqdor {selectedProduct && `(${selectedProduct.unit === "ton" ? "t" : "kg"})`}
                      </Label>
                      <Input type="number" step="any" {...register(`items.${index}.quantity`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Narxi (1 birlik uchun)</Label>
                      <Input type="number" step="any" {...register(`items.${index}.unitPrice`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Yuk puli (so&apos;m)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        {...register(`items.${index}.freightCostUzs`)}
                      />
                    </div>
                  </div>
                  {qty > 0 && price > 0 && (
                    <p className="mt-2 text-right text-sm text-muted-foreground">
                      Jami: {formatMoney(qty * price, currency)}
                      {Number(items[index]?.freightCostUzs) > 0 &&
                        ` + ${formatMoney(items[index]?.freightCostUzs ?? 0)} (yuk puli)`}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="border-t pt-3 space-y-1">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Umumiy summa (mahsulotlar)</span>
                <span>{formatMoney(total, currency)}</span>
              </div>
              {freightTotal > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Yuk puli jami</span>
                  <span>{formatMoney(freightTotal)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yetkazib beruvchiga to'lov (ixtiyoriy)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="initialPayment">Berilgan pul</Label>
              <Input
                id="initialPayment"
                type="number"
                step="any"
                placeholder="0 - agar hali to'lanmagan bo'lsa"
                {...register("initialPayment")}
              />
            </div>
            <div className="space-y-2">
              <Label>To'lov usuli</Label>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={[
                      { value: "cash", label: "Naqd" },
                      { value: "card", label: "Karta" },
                      { value: "bank", label: "Bank o'tkazmasi" },
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Naqd</SelectItem>
                      <SelectItem value="card">Karta</SelectItem>
                      <SelectItem value="bank">Bank o'tkazmasi</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Izoh</Label>
              <Textarea id="notes" {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saqlanmoqda..." : "Kirimni saqlash"}
        </Button>
      </form>

      {/* Ro'yxatda yo'q yangi yetkazib beruvchi bo'lsa, shu yerdan
          chiqmasdan qo'shish mumkin - qo'shilgach avtomatik tanlanadi. */}
      <PartnerFormDialog
        open={partnerFormOpen}
        onOpenChange={setPartnerFormOpen}
        onCreated={(p) => setValue("partnerId", p.id)}
      />
    </div>
  );
}
