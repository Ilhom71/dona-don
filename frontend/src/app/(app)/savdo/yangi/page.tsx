"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
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
import type { Partner, Product, Sale, Warehouse, ProductStock, StockLot, DayStatus } from "@/lib/types";
import { formatDate, formatMoney, formatQuantity, toDateInputValue } from "@/lib/format";

const itemSchema = z.object({
  productId: z.string().uuid("Mahsulot tanlang"),
  quantity: z.string().min(1, "Miqdor kiritilishi shart"),
  unitPrice: z.string().min(1, "Narx kiritilishi shart"),
  // yuk puli (tashish xarajati) - ixtiyoriy, doim so'mda kiritiladi
  freightCostUzs: z.string().optional(),
  // Qaysi partiyadan (narxdan) sotilsin - bo'sh bo'lsa avtomatik (FIFO,
  // kerak bo'lsa bir nechta partiyani birlashtirib)
  lotId: z.string().optional(),
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
  const editId = searchParams.get("editId");
  const isEdit = !!editId;
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
  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: () => api.get<ProductStock[]>("/stock/levels"),
  });
  // Har xil narxda kirim qilingan (masalan har xil hamkordan olingan)
  // partiyalar - "qaysi partiyadan sotilsin" tanlovi shu yerdan olinadi.
  const { data: lots } = useQuery({
    queryKey: ["stock-lots"],
    queryFn: () => api.get<StockLot[]>("/stock/lots"),
  });
  const { data: editingSale } = useQuery({
    queryKey: ["sale", editId],
    queryFn: () => api.get<Sale>(`/sales/${editId}`),
    enabled: isEdit,
  });
  // Yangi savdo yaratish kun ochilishini talab qiladi (tahrirlashga
  // taalluqli emas) - Kassa bosh sahifasidagi "Kun holati" bilan bir xil.
  const { data: dayStatus } = useQuery({
    queryKey: ["day-status"],
    queryFn: () => api.get<DayStatus>("/day-closings/status"),
    enabled: !isEdit,
  });
  const dayBlocked = !isEdit && dayStatus && !dayStatus.canSell;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partnerId: initialPartnerId,
      warehouseId: "",
      vehicleNumber: "",
      saleDate: toDateInputValue(new Date()),
      currency: "UZS",
      items: [
        { productId: initialProductId, quantity: "", unitPrice: "", freightCostUzs: "", lotId: "" },
      ],
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
    if (!isEdit && !warehouseId && warehouses?.length === 1) {
      setValue("warehouseId", warehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses, isEdit]);

  // Tahrirlash rejimida - mavjud savdo ma'lumotlari yuklangach forma to'ldiriladi.
  useEffect(() => {
    if (editingSale) {
      reset({
        partnerId: editingSale.partnerId,
        warehouseId: editingSale.warehouseId ?? "",
        vehicleNumber: editingSale.vehicleNumber ?? "",
        saleDate: toDateInputValue(editingSale.saleDate),
        currency: editingSale.currency,
        items: (editingSale.items ?? []).map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          freightCostUzs: Number(i.freightCostUzs) > 0 ? i.freightCostUzs : "",
          lotId: "",
        })),
        initialPayment: "",
        paymentMethod: "cash",
        notes: editingSale.notes ?? "",
      });
    }
  }, [editingSale, reset]);

  const availableQty = (productId: string) => {
    if (!warehouseId) return null;
    const level = stockLevels?.find((s) => s.productId === productId && s.warehouseId === warehouseId);
    return Number(level?.quantity ?? 0);
  };

  // Tanlangan mahsulot/ombor uchun faol partiyalar (eng eskisi birinchi).
  const lotsFor = (productId: string) => {
    if (!warehouseId || !productId) return [];
    return (lots ?? []).filter((l) => l.productId === productId && l.warehouseId === warehouseId);
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
    setValue(`items.${index}.lotId`, "");
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

  // Barcha qatorlar bo'yicha yuk puli yig'indisi (doim so'mda, hisobot uchun)
  const freightTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.freightCostUzs) || 0), 0);
  }, [items]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        partnerId: values.partnerId,
        warehouseId: values.warehouseId,
        vehicleNumber: values.vehicleNumber || null,
        saleDate: new Date(values.saleDate).toISOString(),
        currency: values.currency,
        items: values.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          freightCostUzs: i.freightCostUzs ? Number(i.freightCostUzs) : null,
          lotId: i.lotId || null,
        })),
        notes: values.notes || null,
      };
      return isEdit
        ? api.put<Sale>(`/sales/${editId}`, payload)
        : api.post<Sale>("/sales", {
            ...payload,
            initialPayment: values.initialPayment ? Number(values.initialPayment) : null,
            paymentMethod: values.paymentMethod,
          });
    },
    onSuccess: (sale) => {
      toast.success(isEdit ? "Savdo tahrirlandi" : "Savdo muvaffaqiyatli yaratildi");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale", sale.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      router.push(`/savdo/tarix/${sale.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{isEdit ? "Savdoni tahrirlash" : "Yangi savdo"}</h1>
        <p className="text-sm text-muted-foreground">
          {isEdit ? "Miqdor, narx va boshqa ma'lumotlarni o'zgartirish" : "Mijozga don sotish"}
        </p>
      </div>

      {dayBlocked && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {dayStatus?.closed
              ? "Bugungi kun yopilgan - savdo qilish uchun avval Kassa sahifasidan kunni qayta oching."
              : "Bugungi kun hali ochilmagan - savdo qilish uchun avval Kassa sahifasidan kunni oching."}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Umumiy ma&apos;lumot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hamkor (mijoz)</Label>
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
              onClick={() =>
                append({ productId: "", quantity: "", unitPrice: "", freightCostUzs: "", lotId: "" })
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

                  {lotsFor(items[index]?.productId).length > 1 && (
                    <div className="mt-3 space-y-2">
                      <Label>
                        Partiya <span className="font-normal text-muted-foreground">(narxi bo'yicha)</span>
                      </Label>
                      <Controller
                        control={control}
                        name={`items.${index}.lotId`}
                        render={({ field }) => (
                          <Select
                            value={field.value || "auto"}
                            onValueChange={(v) => field.onChange(v === "auto" ? "" : v)}
                            items={[
                              { value: "auto", label: "Avtomatik (eng eski partiyadan, kerak bo'lsa birlashtirib)" },
                              ...lotsFor(items[index]?.productId).map((lot) => ({
                                value: lot.id,
                                label: `${formatMoney(lot.unitCostUzs)}/birlik - ${formatQuantity(lot.remainingQuantity, lot.unit)} mavjud (${formatDate(lot.receivedAt)}${lot.supplierName ? `, ${lot.supplierName}` : ""})`,
                              })),
                            ]}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">
                                Avtomatik (eng eski partiyadan, kerak bo&apos;lsa birlashtirib)
                              </SelectItem>
                              {lotsFor(items[index]?.productId).map((lot) => (
                                <SelectItem key={lot.id} value={lot.id}>
                                  {formatMoney(lot.unitCostUzs)}/birlik -{" "}
                                  {formatQuantity(lot.remainingQuantity, lot.unit)} mavjud (
                                  {formatDate(lot.receivedAt)}
                                  {lot.supplierName ? `, ${lot.supplierName}` : ""})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>
                        Miqdor {selectedProduct && `(${selectedProduct.unit === "ton" ? "t" : "kg"})`}
                      </Label>
                      <Input type="number" step="any" {...register(`items.${index}.quantity`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Narxi (1 birlik uchun)</Label>
                      <Controller
                        control={control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <MoneyInput value={field.value} onChange={field.onChange} allowDecimal />
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Yuk puli (so&apos;m)</Label>
                      <Controller
                        control={control}
                        name={`items.${index}.freightCostUzs`}
                        render={({ field }) => (
                          <MoneyInput placeholder="0" value={field.value} onChange={field.onChange} />
                        )}
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

        {isEdit ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">To'lov</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tahrirlashda to&apos;lov o&apos;zgartirilmaydi - hozircha to&apos;langan:{" "}
                <span className="font-medium text-foreground">
                  {formatMoney(editingSale?.paidAmountUzs ?? 0)}
                </span>
                . Qo&apos;shimcha to&apos;lash uchun savdo tafsilotidagi &quot;To&apos;lov
                qo&apos;shish&quot;dan foydalaning.
              </p>
              <div className="space-y-2">
                <Label htmlFor="notes">Izoh</Label>
                <Textarea id="notes" {...register("notes")} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">To'lov (ixtiyoriy)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="initialPayment">Boshlang'ich to'lov</Label>
                <Controller
                  control={control}
                  name="initialPayment"
                  render={({ field }) => (
                    <MoneyInput
                      id="initialPayment"
                      placeholder="0 - agar to'liq nasiya bo'lsa"
                      allowDecimal
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
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
        )}

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending || dayBlocked}>
          {mutation.isPending ? "Saqlanmoqda..." : isEdit ? "O'zgarishlarni saqlash" : "Savdoni saqlash"}
        </Button>
      </form>

      {/* Ro'yxatda yo'q yangi mijoz bo'lsa, shu yerdan chiqmasdan qo'shish
          mumkin - qo'shilgach avtomatik tanlanadi. */}
      <PartnerFormDialog
        open={partnerFormOpen}
        onOpenChange={setPartnerFormOpen}
        onCreated={(p) => setValue("partnerId", p.id)}
      />
    </div>
  );
}
