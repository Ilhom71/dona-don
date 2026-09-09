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
import type { Partner, Product, Purchase, Warehouse } from "@/lib/types";
import { formatMoney, toDateInputValue } from "@/lib/format";

const itemSchema = z.object({
  productId: z.string().uuid("Mahsulot tanlang"),
  quantity: z.string().min(1, "Miqdor kiritilishi shart"),
  unitPrice: z.string().min(1, "Narx kiritilishi shart"),
  // Tanlangan mahsulotning joriy tan narxidan farq qiladigan narxda kirim
  // qilinsa, bu partiya eskisi bilan aralashtirilmaydi - o'rniga shu nom
  // bilan yangi, alohida mahsulot yaratiladi (pastdagi tan narx taqqoslash
  // mantig'iga qara).
  newProductName: z.string().optional(),
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
  const { data: editingPurchase } = useQuery({
    queryKey: ["purchase", editId],
    queryFn: () => api.get<Purchase>(`/purchases/${editId}`),
    enabled: isEdit,
  });
  // Narx taqqoslashda USD->UZS o'girish uchun (mahsulotning avgCostUzs doim
  // UZS'da saqlanadi).
  const { data: rateData } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => api.get<{ rate: number | null }>("/settings/exchange-rate"),
  });

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
      warehouseId: initialWarehouseId,
      vehicleNumber: "",
      purchaseDate: toDateInputValue(new Date()),
      currency: "UZS",
      items: [{ productId: "", quantity: "", unitPrice: "", newProductName: "" }],
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
    if (!isEdit && !initialWarehouseId && warehouses?.length === 1) {
      setValue("warehouseId", warehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses, isEdit]);

  // Tahrirlash rejimida - mavjud xarid ma'lumotlari yuklangach forma to'ldiriladi.
  useEffect(() => {
    if (editingPurchase) {
      reset({
        partnerId: editingPurchase.partnerId,
        warehouseId: editingPurchase.warehouseId ?? "",
        vehicleNumber: editingPurchase.vehicleNumber ?? "",
        purchaseDate: toDateInputValue(editingPurchase.purchaseDate),
        currency: editingPurchase.currency,
        items: (editingPurchase.items ?? []).map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          newProductName: "",
        })),
        initialPayment: "",
        paymentMethod: "cash",
        notes: editingPurchase.notes ?? "",
      });
    }
  }, [editingPurchase, reset]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const rate = rateData?.rate ?? 0;

  // Kiritilayotgan narxni UZS'ga o'giradi (avgCostUzs doim UZS) - taqqoslash
  // uchun. USD tanlanib kurs hali kiritilmagan bo'lsa taqqoslab bo'lmaydi.
  function enteredPriceUzs(unitPrice: string) {
    const price = Number(unitPrice) || 0;
    return currency === "USD" ? price * rate : price;
  }

  // Tanlangan mahsulotning joriy (o'rtacha) tan narxidan sezilarli farq
  // qilsa - bu boshqa narxda kirgan alohida partiya, eskisi bilan
  // aralashtirib (o'rtachalab) bo'lmaydi. Shu holatda foydalanuvchidan yangi,
  // alohida mahsulot uchun nom so'raladi. Faqat YANGI kirim yaratishda -
  // tahrirlashda emas: `updatePurchase` narxni qayta hisoblashda har doim
  // JORIY kursni ishlatadi (asl xariddagi kurs emas), shuning uchun USD
  // xaridni faqat mashina raqami/izoh kabi narxga aloqasi yo'q maydonni
  // tuzatish uchun ochib-saqlashda ham kurs siljigan bo'lsa "narx farq
  // qiladi" deb noto'g'ri signal berib, keraksiz mahsulot yaratib yubormasin.
  function priceMismatch(item: { productId?: string; unitPrice?: string } | undefined) {
    if (isEdit) return null;
    if (!item?.productId || !item.unitPrice) return null;
    if (currency === "USD" && !rate) return null;
    const product = products?.find((p) => p.id === item.productId);
    if (!product) return null;
    const currentCost = Number(product.avgCostUzs);
    if (!currentCost) return null;
    const newCost = enteredPriceUzs(item.unitPrice);
    if (Math.abs(newCost - currentCost) <= Math.max(1, currentCost * 0.001)) return null;
    return { product, currentCost, newCost };
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Narxi mos kelmagan qatorlar uchun avval yangi, alohida mahsulot
      // yaratiladi (foydalanuvchi kiritgan nom bilan) - shundan keyingina
      // xarid o'sha yangi mahsulot ID'si bilan yuboriladi. Ketma-ket (parallel
      // emas) ishlatiladi + keshlanadi - bitta kirimda ikki qator bir xil
      // bazaviy mahsulotga bir xil (yoki bo'sh, ya'ni bazaviy) nom bilan
      // ajralsa, ikkalasi HAM o'sha bitta yangi mahsulotga yozilsin, ikkita
      // bir xil nomli alohida mahsulot yaratilib ketmasin.
      const createdByKey = new Map<string, string>();
      const resolvedItems: { productId: string; quantity: number; unitPrice: number }[] = [];
      for (const i of values.items) {
        const mismatch = priceMismatch(i);
        if (mismatch) {
          const baseProduct = mismatch.product;
          const name = i.newProductName?.trim() || baseProduct.name;
          const cacheKey = `${baseProduct.id}::${name}`;
          let productId = createdByKey.get(cacheKey);
          if (!productId) {
            const created = await api.post<Product>("/products", {
              name,
              unit: baseProduct.unit,
              sellingPriceUzs: baseProduct.sellingPriceUzs ?? null,
            });
            productId = created.id;
            createdByKey.set(cacheKey, productId);
          }
          resolvedItems.push({ productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) });
        } else {
          resolvedItems.push({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          });
        }
      }

      const payload = {
        partnerId: values.partnerId,
        warehouseId: values.warehouseId,
        vehicleNumber: values.vehicleNumber || null,
        purchaseDate: new Date(values.purchaseDate).toISOString(),
        currency: values.currency,
        items: resolvedItems,
        notes: values.notes || null,
      };
      return isEdit
        ? api.put<Purchase>(`/purchases/${editId}`, payload)
        : api.post<Purchase>("/purchases", {
            ...payload,
            initialPayment: values.initialPayment ? Number(values.initialPayment) : null,
            paymentMethod: values.paymentMethod,
          });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Kirim tahrirlandi" : "Xarid (kirim) muvaffaqiyatli saqlandi");
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["purchase", editId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-lots"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      router.push("/ombor/kirim-chiqim");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isEdit ? "Kirimni tahrirlash" : "Yangi kirim (xarid)"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEdit
            ? "Miqdor, narx va boshqa ma'lumotlarni o'zgartirish"
            : "Yetkazib beruvchidan don sotib olish"}
        </p>
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
                append({ productId: "", quantity: "", unitPrice: "", newProductName: "" })
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
              const mismatch = priceMismatch(items[index]);
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
                  <div className="mt-3 grid grid-cols-2 gap-3">
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
                  </div>
                  {mismatch && (
                    <div className="mt-3 space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5">
                      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Bu narx (
                        {formatMoney(mismatch.newCost)}) &quot;{mismatch.product.name}&quot;ning joriy
                        tan narxidan ({formatMoney(mismatch.currentCost)}) farq qiladi - eskisi bilan
                        aralashtirilmaydi, alohida mahsulot sifatida saqlanadi.
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs">Yangi mahsulot nomi</Label>
                        <Input
                          placeholder={mismatch.product.name}
                          {...register(`items.${index}.newProductName`)}
                        />
                      </div>
                    </div>
                  )}
                  {qty > 0 && price > 0 && (
                    <p className="mt-2 text-right text-sm text-muted-foreground">
                      Jami: {formatMoney(qty * price, currency)}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="border-t pt-3">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Umumiy summa</span>
                <span>{formatMoney(total, currency)}</span>
              </div>
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
                  {formatMoney(editingPurchase?.paidAmountUzs ?? 0)}
                </span>
                . Qo&apos;shimcha to&apos;lash uchun Kassa bo&apos;limidan foydalaning.
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
              <CardTitle className="text-base">Yetkazib beruvchiga to'lov (ixtiyoriy)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="initialPayment">Berilgan pul</Label>
                <Controller
                  control={control}
                  name="initialPayment"
                  render={({ field }) => (
                    <MoneyInput
                      id="initialPayment"
                      placeholder="0 - agar hali to'lanmagan bo'lsa"
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

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saqlanmoqda..." : isEdit ? "O'zgarishlarni saqlash" : "Kirimni saqlash"}
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
