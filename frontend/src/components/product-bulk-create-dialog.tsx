"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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

const rowSchema = z.object({
  name: z.string().min(1, "Nomi kiritilishi shart"),
  unit: z.enum(["kg", "ton"]),
  sellingPriceUzs: z.string().optional(),
  minStockAlert: z.string().optional(),
  notes: z.string().optional(),
});

const schema = z.object({
  items: z.array(rowSchema).min(1, "Kamida bitta mahsulot qo'shing"),
});

type FormValues = z.infer<typeof schema>;

const emptyRow = {
  name: "",
  unit: "kg" as const,
  sellingPriceUzs: "",
  minStockAlert: "",
  notes: "",
};

/**
 * Bir nechta mahsulotni ketma-ket, alohida-alohida qo'shish uchun - har bir
 * qator alohida mahsulot bo'lib yaratiladi (Yangi savdo/Xarid formalaridagi
 * "qator qo'shish" naqshiga o'xshash). Tahrirlash uchun hali ham
 * `ProductFormDialog` ishlatiladi (bu yerda faqat yangi qo'shish).
 */
export function ProductBulkCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [emptyRow] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (open) reset({ items: [emptyRow] });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const results = await Promise.allSettled(
        values.items.map((item) =>
          api.post("/products", {
            name: item.name,
            unit: item.unit,
            sellingPriceUzs: item.sellingPriceUzs ? item.sellingPriceUzs : null,
            minStockAlert: item.minStockAlert ? item.minStockAlert : null,
            notes: item.notes ? item.notes : null,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      return { total: values.items.length, failedCount: failed.length };
    },
    onSuccess: ({ total, failedCount }) => {
      if (failedCount === 0) {
        toast.success(`${total} ta mahsulot qo'shildi`);
      } else {
        toast.error(`${total - failedCount} ta qo'shildi, ${failedCount} tasi xato berdi`);
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Xatolik yuz berdi"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yangi mahsulotlar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          {errors.items?.root && (
            <p className="text-sm text-destructive">{errors.items.root.message}</p>
          )}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nomi</Label>
                    <Input {...register(`items.${index}.name`)} placeholder="Masalan: Bug'doy" />
                    {errors.items?.[index]?.name && (
                      <p className="text-xs text-destructive">{errors.items[index]?.name?.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-5"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Birlik</Label>
                    <Controller
                      control={control}
                      name={`items.${index}.unit`}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={[
                            { value: "kg", label: "kg" },
                            { value: "ton", label: "t" },
                          ]}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="ton">t</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sotuv narxi</Label>
                    <Controller
                      control={control}
                      name={`items.${index}.sellingPriceUzs`}
                      render={({ field }) => (
                        <MoneyInput
                          placeholder="ixtiyoriy"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                  <div className="col-span-2 space-y-1 sm:col-span-2">
                    <Label className="text-xs">Kam qolish chegarasi</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="ixtiyoriy"
                      {...register(`items.${index}.minStockAlert`)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Izoh</Label>
                  <Textarea
                    rows={2}
                    placeholder="ixtiyoriy"
                    {...register(`items.${index}.notes`)}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyRow)}>
            <Plus className="h-4 w-4" />
            Yana mahsulot qo&apos;shish
          </Button>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saqlanmoqda..." : `Saqlash (${fields.length} ta)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
