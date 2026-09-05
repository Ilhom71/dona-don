import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { products, sales, saleItems, stockMovements, payments } from "../../db/schema";
import { getCurrentRate } from "../settings/service";
import { adjustWarehouseStock, recomputeProductAggregate } from "../stock/service";

type SaleItemInput = { productId: string; quantity: number; unitPrice: number };

type CreateSaleInput = {
  partnerId: string;
  warehouseId: string;
  vehicleNumber?: string | null;
  saleDate?: Date;
  currency: "UZS" | "USD";
  items: SaleItemInput[];
  initialPayment?: number | null; // sale.currency birligida, savdo yaratilishi bilanoq to'langan summa
  paymentMethod?: "cash" | "card" | "bank";
  notes?: string | null;
};

function paymentStatusFor(paidUzs: number, totalUzs: number): "paid" | "partial" | "credit" {
  if (paidUzs <= 0) return "credit";
  if (paidUzs >= totalUzs) return "paid";
  return "partial";
}

/**
 * Yangi savdo yaratadi: tanlangan ombordan sotilgan mahsulotlarni yechadi
 * (chiqim yozuvlari bilan birga), umumiy summani hisoblaydi va ixtiyoriy
 * boshlang'ich to'lovni qayd etadi. Hammasi bitta tranzaksiyada bajariladi.
 */
export async function createSale(input: CreateSaleInput) {
  if (input.items.length === 0) throw new Error("Savdoda kamida bitta mahsulot bo'lishi kerak");

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    let totalAmount = 0;

    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      costPriceUzsSnapshot: string;
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      let costSnapshot: string;
      try {
        const result = await adjustWarehouseStock(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          type: "out",
          quantity: item.quantity,
          priceUzs: null,
          unitLabel: product.unit,
        });
        costSnapshot = String(result.newCostUzs);
      } catch (err) {
        throw new Error(`"${product.name}": ${(err as Error).message}`);
      }

      const subtotal = item.quantity * item.unitPrice;
      totalAmount += subtotal;

      itemRows.push({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        subtotal: String(subtotal),
        costPriceUzsSnapshot: costSnapshot,
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    const totalAmountUzs = input.currency === "USD" ? totalAmount * rate : totalAmount;
    const initialPayment = input.initialPayment ?? 0;
    const paidAmountUzs = input.currency === "USD" ? initialPayment * rate : initialPayment;

    const [sale] = await tx
      .insert(sales)
      .values({
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        vehicleNumber: input.vehicleNumber ?? null,
        saleDate: input.saleDate ?? new Date(),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        totalAmount: String(totalAmount),
        totalAmountUzs: String(totalAmountUzs),
        paidAmountUzs: String(paidAmountUzs),
        paymentStatus: paymentStatusFor(paidAmountUzs, totalAmountUzs),
        notes: input.notes ?? null,
      })
      .returning();

    if (!sale) throw new Error("Savdo yozuvini yaratib bo'lmadi");

    await tx.insert(saleItems).values(itemRows.map((r) => ({ ...r, saleId: sale.id })));

    await tx.insert(stockMovements).values(
      input.items.map((item) => ({
        productId: item.productId,
        type: "out" as const,
        source: "sale" as const,
        quantity: String(item.quantity),
        pricePerUnit: String(item.unitPrice),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        saleId: sale.id,
        vehicleNumber: input.vehicleNumber ?? null,
        movementDate: input.saleDate ?? new Date(),
      }))
    );

    if (paidAmountUzs > 0) {
      await tx.insert(payments).values({
        partnerId: input.partnerId,
        saleId: sale.id,
        amount: String(initialPayment),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        amountUzs: String(paidAmountUzs),
        method: input.paymentMethod ?? "cash",
      });
    }

    return sale;
  });
}

export async function listSales(filters: {
  partnerId?: string;
  paymentStatus?: "paid" | "partial" | "credit";
  from?: Date;
  to?: Date;
}) {
  const conditions = [];
  if (filters.partnerId) conditions.push(eq(sales.partnerId, filters.partnerId));
  if (filters.paymentStatus) conditions.push(eq(sales.paymentStatus, filters.paymentStatus));
  if (filters.from) conditions.push(gte(sales.saleDate, filters.from));
  if (filters.to) conditions.push(lte(sales.saleDate, filters.to));

  return db.query.sales.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(sales.saleDate),
    with: { partner: true, warehouse: true },
  });
}

export async function getSale(id: string) {
  return db.query.sales.findFirst({
    where: eq(sales.id, id),
    with: {
      partner: true,
      warehouse: true,
      items: { with: { product: true } },
      payments: true,
    },
  });
}
