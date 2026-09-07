import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { products, purchases, purchaseItems, stockMovements } from "../../db/schema";
import { getCurrentRate } from "../settings/service";
import { adjustWarehouseStock, recomputeProductAggregate } from "../stock/service";
import { createExpense } from "../expenses/service";

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  freightCostUzs?: number | null; // yuk puli (tashish xarajati), doim UZS, ixtiyoriy
};

type CreatePurchaseInput = {
  partnerId: string;
  warehouseId: string;
  vehicleNumber?: string | null;
  purchaseDate?: Date;
  currency: "UZS" | "USD";
  items: PurchaseItemInput[];
  initialPayment?: number | null; // xarid valyutasida, yetkazib beruvchiga darhol berilgan pul
  paymentMethod?: "cash" | "card" | "bank";
  notes?: string | null;
};

function paymentStatusFor(paidUzs: number, totalUzs: number): "paid" | "partial" | "credit" {
  if (paidUzs <= 0) return "credit";
  if (paidUzs >= totalUzs) return "paid";
  return "partial";
}

/**
 * Yangi xarid (kirim) yaratadi: tanlangan omborga mahsulotlarni qo'shadi
 * (kirim yozuvlari bilan birga, yuk puli ham hisobga olingan "landed cost"
 * bilan og'irlikli o'rtacha tannarxni yangilaydi), umumiy summani hisoblaydi
 * va ixtiyoriy boshlang'ich to'lovni (yetkazib beruvchiga) qayd etadi.
 * Hammasi bitta tranzaksiyada bajariladi - sales/createSale'ga parallel.
 */
export async function createPurchase(input: CreatePurchaseInput) {
  if (input.items.length === 0) throw new Error("Xaridda kamida bitta mahsulot bo'lishi kerak");

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    let totalAmount = 0; // mahsulotlar summasi, xarid valyutasida (yuk pulisiz)
    let freightTotalUzs = 0;

    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      freightCostUzs: string;
      landedCostUzsSnapshot: string;
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      const subtotal = item.quantity * item.unitPrice;
      const subtotalUzs = input.currency === "USD" ? subtotal * rate : subtotal;
      const freightCostUzs = item.freightCostUzs ?? 0;
      totalAmount += subtotal;
      freightTotalUzs += freightCostUzs;

      // Landed cost: mahsulot narxi + yuk puli, bir birlikka bo'lingan holda -
      // shu qiymat omborning og'irlikli o'rtacha tannarxini yangilash uchun ishlatiladi.
      const landedCostUzs = (subtotalUzs + freightCostUzs) / item.quantity;

      try {
        await adjustWarehouseStock(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          type: "in",
          quantity: item.quantity,
          priceUzs: landedCostUzs,
          unitLabel: product.unit,
        });
      } catch (err) {
        throw new Error(`"${product.name}": ${(err as Error).message}`);
      }

      itemRows.push({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        subtotal: String(subtotal),
        freightCostUzs: String(freightCostUzs),
        landedCostUzsSnapshot: String(landedCostUzs),
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    // Umumiy qarz (totalAmountUzs) = mahsulotlar summasi (UZS'ga o'girilgan) + yuk puli yig'indisi.
    const totalAmountUzs = (input.currency === "USD" ? totalAmount * rate : totalAmount) + freightTotalUzs;
    const initialPayment = input.initialPayment ?? 0;
    const paidAmountUzs = input.currency === "USD" ? initialPayment * rate : initialPayment;

    const [purchase] = await tx
      .insert(purchases)
      .values({
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        vehicleNumber: input.vehicleNumber ?? null,
        purchaseDate: input.purchaseDate ?? new Date(),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        totalAmount: String(totalAmount),
        totalAmountUzs: String(totalAmountUzs),
        paidAmountUzs: String(paidAmountUzs),
        paymentStatus: paymentStatusFor(paidAmountUzs, totalAmountUzs),
        notes: input.notes ?? null,
      })
      .returning();

    if (!purchase) throw new Error("Xarid yozuvini yaratib bo'lmadi");

    await tx.insert(purchaseItems).values(itemRows.map((r) => ({ ...r, purchaseId: purchase.id })));

    await tx.insert(stockMovements).values(
      input.items.map((item) => ({
        productId: item.productId,
        type: "in" as const,
        source: "purchase" as const,
        quantity: String(item.quantity),
        pricePerUnit: String(item.unitPrice),
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        purchaseId: purchase.id,
        vehicleNumber: input.vehicleNumber ?? null,
        movementDate: input.purchaseDate ?? new Date(),
      }))
    );

    // Boshlang'ich to'lov - kassadan yetkazib beruvchiga chiqim sifatida, mavjud
    // xarajat infratuzilmasidan foydalanib (avtomatik Kassa lentasida ko'rinadi).
    if (paidAmountUzs > 0) {
      await createExpense(
        {
          category: "supplier_payment",
          partnerId: input.partnerId,
          amount: initialPayment,
          currency: input.currency,
          method: input.paymentMethod ?? "cash",
          description: `Xarid uchun to'lov${input.vehicleNumber ? ` (${input.vehicleNumber})` : ""}`,
        },
        tx
      );
    }

    return purchase;
  });
}

/**
 * Xaridni bekor qiladi (storno). Loyihadagi "immutable ledger" qoidasiga ko'ra
 * yozuv o'chirilmaydi/tahrirlanmaydi - shuning uchun bu funksiya faqat:
 *  1) har bir mahsulot uchun ombordan teskari (chiqim, source="purchase_reversal")
 *     yozuv qo'shib, kirim qilingan miqdorni ayiradi,
 *  2) purchases jadvalida faqat cancelledAt/cancelReason to'ldiradi.
 * Agar shu mahsulot allaqachon boshqa savdoda ishlatilgan bo'lsa (ombordagi
 * qoldiq yetarli bo'lmasa), xato qaytaradi - bekor qilinmaydi.
 * Sales/cancelSale'ga parallel - shu bilan bir xil sabablarga ko'ra bir
 * tomonlama (tiklab bo'lmaydi).
 */
export async function cancelPurchase(id: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const purchase = await tx.query.purchases.findFirst({
      where: eq(purchases.id, id),
      with: { items: { with: { product: true } } },
    });
    if (!purchase) throw new Error("Xarid topilmadi");
    if (purchase.cancelledAt) throw new Error("Bu xarid allaqachon bekor qilingan");
    if (!purchase.warehouseId) throw new Error("Xaridning ombori aniqlanmagan, bekor qilib bo'lmaydi");

    const rate = await getCurrentRate();

    for (const item of purchase.items ?? []) {
      try {
        await adjustWarehouseStock(tx, {
          productId: item.productId,
          warehouseId: purchase.warehouseId,
          type: "out",
          quantity: Number(item.quantity),
          priceUzs: null,
          unitLabel: item.product?.unit ?? "kg",
        });
      } catch (err) {
        throw new Error(`"${item.product?.name ?? ""}": ${(err as Error).message}`);
      }
      await recomputeProductAggregate(tx, item.productId);

      await tx.insert(stockMovements).values({
        productId: item.productId,
        type: "out",
        source: "purchase_reversal",
        quantity: item.quantity,
        pricePerUnit: item.landedCostUzsSnapshot,
        currency: "UZS",
        exchangeRateSnapshot: String(rate),
        partnerId: purchase.partnerId,
        warehouseId: purchase.warehouseId,
        purchaseId: purchase.id,
        vehicleNumber: purchase.vehicleNumber,
        note: reason ? `Xarid bekor qilindi: ${reason}` : "Xarid bekor qilindi",
      });
    }

    const [updated] = await tx
      .update(purchases)
      .set({
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
        paymentStatus: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, id))
      .returning();

    return updated;
  });
}

export async function listPurchases(filters: {
  partnerId?: string;
  paymentStatus?: "paid" | "partial" | "credit" | "cancelled";
  from?: Date;
  to?: Date;
}) {
  const conditions = [];
  if (filters.partnerId) conditions.push(eq(purchases.partnerId, filters.partnerId));
  if (filters.paymentStatus) conditions.push(eq(purchases.paymentStatus, filters.paymentStatus));
  if (filters.from) conditions.push(gte(purchases.purchaseDate, filters.from));
  if (filters.to) conditions.push(lte(purchases.purchaseDate, filters.to));

  return db.query.purchases.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: desc(purchases.purchaseDate),
    with: { partner: true, warehouse: true },
  });
}

export async function getPurchase(id: string) {
  return db.query.purchases.findFirst({
    where: eq(purchases.id, id),
    with: {
      partner: true,
      warehouse: true,
      items: { with: { product: true } },
    },
  });
}
