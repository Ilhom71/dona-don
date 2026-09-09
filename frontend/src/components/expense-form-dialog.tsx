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
import { PartnerFormDialog } from "@/components/partner-form-dialog";
import { api, ApiError } from "@/lib/api";
import type { Partner } from "@/lib/types";
import { expenseCategoryLabels, paymentMethodLabels } from "@/lib/format";

const categoryItems = Object.entries(expenseCategoryLabels).map(([value, label]) => ({
  value,
  label,
}));
const methodItems = Object.entries(paymentMethodLabels).map(([value, label]) => ({
  value,
  label,
}));

const schema = z.object({
  category: z.enum([
    "supplier_payment",
    "salary",
    "rent",
    "transport",
    "utilities",
    "other",
  ]),
  partnerId: z.string().optional(),
  amount: z.string().min(1, "Summa kiritilishi shart"),
  currency: z.enum(["UZS", "USD"]),
  method: z.enum(["cash", "card", "bank"]),
  description: z.string().min(1, "Tavsif kiritilishi shart"),
});

type FormValues = z.infer<typeof schema>;

const defaultValues: FormValues = {
  category: "other",
  partnerId: "",
  amount: "",
  currency: "UZS",
  method: "cash",
  description: "",
};

export function ExpenseFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
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
    defaultValues,
  });

  const category = watch("category");

  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => api.get<Partner[]>("/partners"),
    enabled: category === "supplier_payment",
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/expenses", {
        category: values.category,
        partnerId: values.category === "supplier_payment" && values.partnerId
          ? values.partnerId
          : null,
        amount: Number(values.amount),
        currency: values.currency,
        method: values.method,
        description: values.description,
      }),
    onSuccess: () => {
      toast.success("Xarajat qayd etildi");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["cash-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yangi xarajat</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label>Kategoriya</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={categoryItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {category === "supplier_payment" && (
            <div className="space-y-2">
              <Label>Yetkazib beruvchi</Label>
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
                        <SelectValue placeholder="Hamkor tanlang" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Summa</Label>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput id="amount" autoFocus value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
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

          <div className="space-y-2">
            <Label>To'lov usuli</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} items={methodItems}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methodItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Tavsif</Label>
            <Textarea id="description" {...register("description")} />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
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
