"use client";

import { Suspense, useEffect, useMemo } from "react";
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
import { api, ApiError } from "@/lib/api";
import type { Partner, Product, Sale, Warehouse, ProductStock } from "@/lib/types";
import { formatMoney, formatQuantity, toDateInputValue } from "@/lib/format";

const itemSchema = z.object({
  productId: z.string().uuid("Mahsulot tanlang"),
  quantity: z.string().min(1, "Miqdor kiritilishi shart"),
  unitPrice: z.string().min(1, "Narx kiritilishi shart"),
});

const schema = z.object({
  partnerId: z.string().uuid("Hamkor tanlang"),
  warehouseId: z.string().uuid("Ombor tanlang"),
  vehicleNumber: z.string().optional(),
  saleDate: z.string(),
  currency: z.enum(["UZS", "USD"]),
  items: z.array(itemSchema).min(1, "Kamida bitta mahsulot qo'shing"),
  initialPayment: z.string().optional(),
  paymentMethod: z.enum(["cash", "card", "bank"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewSalePage() {
  return (
    <Suspense fallback={null}>
      <NewSaleForm />
    </Suspense>
  );
}

function NewSaleForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId") ?? "";
  const initialPartnerId = searchParams.get("partnerId") ?? "";

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
  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: () => api.get<ProductStock[]>("/stock/levels"),
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
      warehouseId: "",
      vehicleNumber: "",
      saleDate: toDateInputValue(new Date()),
      currency: "UZS",
      items: [{ productId: initialProductId, quantity: "", unitPrice: "" }],
      initialPayment: "",
      paymentMethod: "cash",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const currency = watch("currency");
  const warehouseId = watch("warehouseId");

  // Faqat bitta ombor bo'lsa, avtomatik tanlab qo'yamiz.
  useEffect(() => {
    if (!warehouseId && warehouses?.length === 1) {
      setValue("warehouseId", warehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses]);

  const availableQty = (productId: string) => {
    if (!warehouseId) return null;
    const level = stockLevels?.find((s) => s.productId === productId && s.warehouseId === warehouseId);
    return Number(level?.quantity ?? 0);
  };

  // Havoladan (masalan mahsulot/hamkor sahifasidagi "Sotish" tugmasi) kelgan
  // mahsulot uchun, agar sotuv narxi belgilangan bo'lsa, narxni avtomatik taklif qiladi.
  useEffect(() => {
    if (initialProductId && currency === "UZS") {
      const product = products?.find((p) => p.id === initialProductId);
      if (product?.sellingPriceUzs) {
        setValue("items.0.unitPrice", product.sellingPriceUzs);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  function handleProductSelect(index: number, productId: string) {
    setValue(`items.${index}.productId`, productId);
    const product = products?.find((p) => p.id === productId);
    if (product?.sellingPriceUzs && currency === "UZS") {
      setValue(`items.${index}.unitPrice`, product.sellingPriceUzs);
    }
  }

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Sale>("/sales", {
        partnerId: values.partnerId,
        warehouseId: values.warehouseId,
        vehicleNumber: values.vehicleNumber || null,
        saleDate: new Date(values.saleDate).toISOString(),
        currency: values.currency,
        items: values.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
        initialPayment: values.initialPayment ? Number(values.initialPayment) : null,
        paymentMethod: values.paymentMethod,
        notes: values.notes || null,
      }),
    onSuccess: (sale) => {
      toast.success("Savdo muvaffaqiyatli yaratildi");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      router.push(`/savdo/tarix/${sale.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Yangi savdo</h1>
        <p className="text-sm text-muted-foreground">Mijozga don sotish</p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Umumiy ma&apos;lumot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hamkor (mijoz)</Label>
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
              <Label htmlFor="saleDate">Sana</Label>
              <Input id="saleDate" type="date" {...register("saleDate")} />
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
              onClick={() => append({ productId: "", quantity: "", unitPrice: "" })}
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
                            onValueChange={(v) => v && handleProductSelect(index, v)}
                            items={
                              products?.map((p) => {
                                const qty = availableQty(p.id);
                                return {
                                  value: p.id,
                                  label: `${p.name}${qty !== null ? ` (${formatQuantity(qty, p.unit)} mavjud)` : ""}`,
                                };
                              }) ?? []
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Mahsulotni tanlang" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((p) => {
                                const qty = availableQty(p.id);
                                return (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                    {qty !== null ? ` (${formatQuantity(qty, p.unit)} mavjud)` : ""}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {!warehouseId && (
                        <p className="text-xs text-muted-foreground">
                          Qoldiqni ko&apos;rish uchun avval omborni tanlang
                        </p>
                      )}
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
                  <div className="mt-3 grid grid-cols-2 gap-3">
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
                  </div>
                  {qty > 0 && price > 0 && (
                    <p className="mt-2 text-right text-sm text-muted-foreground">
                      Jami: {formatMoney(qty * price, currency)}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Umumiy summa</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">To'lov (ixtiyoriy)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="initialPayment">Boshlang'ich to'lov</Label>
              <Input
                id="initialPayment"
                type="number"
                step="any"
                placeholder="0 - agar to'liq nasiya bo'lsa"
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
          {mutation.isPending ? "Saqlanmoqda..." : "Savdoni saqlash"}
        </Button>
      </form>
    </div>
  );
}
