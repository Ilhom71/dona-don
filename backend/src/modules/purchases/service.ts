import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { products, purchases, purchaseItems, stockMovements } from "../../db/schema";
import { getCurrentRate } from "../settings/service";
import {
  adjustWarehouseStock,
  recomputeProductAggregate,
  createLot,
  cancelLotsForCreation,
} from "../stock/service";
import { createExpense } from "../expenses/service";

type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
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

// Tahrirlashda to'lov o'zgartirilmaydi (mavjud paidAmountUzs saqlanadi, faqat
// yangi jamiga qarab holat qayta hisoblanadi) - shuning uchun initialPayment yo'q.
type UpdatePurchaseInput = {
  partnerId: string;
  warehouseId: string;
  vehicleNumber?: string | null;
  purchaseDate?: Date;
  currency: "UZS" | "USD";
  items: PurchaseItemInput[];
  notes?: string | null;
};

function paymentStatusFor(paidUzs: number, totalUzs: number): "paid" | "partial" | "credit" {
  if (paidUzs <= 0) return "credit";
  if (paidUzs >= totalUzs) return "paid";
  return "partial";
}

/**
 * Yangi xarid (kirim) yaratadi: tanlangan omborga mahsulotlarni qo'shadi
 * (kirim yozuvlari bilan birga tannarxni ham yangilaydi), umumiy summani
 * hisoblaydi va ixtiyoriy boshlang'ich to'lovni (yetkazib beruvchiga) qayd
 * etadi. Hammasi bitta tranzaksiyada bajariladi - sales/createSale'ga parallel.
 */
export async function createPurchase(input: CreatePurchaseInput) {
  if (input.items.length === 0) throw new Error("Xaridda kamida bitta mahsulot bo'lishi kerak");

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    let totalAmount = 0; // mahsulotlar summasi, xarid valyutasida

    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      landedCostUzsSnapshot: string;
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      const subtotal = item.quantity * item.unitPrice;
      const subtotalUzs = input.currency === "USD" ? subtotal * rate : subtotal;
      totalAmount += subtotal;

      // Landed cost - bitta birlik uchun UZS narx, omborning tannarxini
      // yangilash uchun ishlatiladi.
      const landedCostUzs = subtotalUzs / item.quantity;

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
        landedCostUzsSnapshot: String(landedCostUzs),
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    // Umumiy qarz (totalAmountUzs) = mahsulotlar summasi, UZS'ga o'girilgan.
    const totalAmountUzs = input.currency === "USD" ? totalAmount * rate : totalAmount;
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

    // Har bir xarid qatori uchun alohida FIFO partiya - narxi (landed cost)
    // hech qachon o'zgarmaydi, keyingi boshqa narxdagi kirim bunga ta'sir
    // qilmaydi (eski qoldiq sotilganda aynan shu narx ishlatiladi).
    for (const row of itemRows) {
      await createLot(tx, {
        productId: row.productId,
        warehouseId: input.warehouseId,
        unitCostUzs: Number(row.landedCostUzsSnapshot),
        quantity: Number(row.quantity),
        source: "purchase",
        purchaseId: purchase.id,
        receivedAt: input.purchaseDate ?? new Date(),
      });
    }

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
 * Mavjud xaridni tahrirlaydi (miqdor, narx, mahsulot, ombor va h.k.) -
 * foydalanuvchi so'roviga ko'ra bu yerda "immutable ledger" qoidasidan
 * ATAYLAB voz kechilgan (savdo/xarid odatda faqat bekor qilinadi, lekin
 * bu funksiya haqiqiy tahrirlash uchun). Ichida: avval eski itemlar
 * yaratgan partiyalar "retire" qilinadi (agar ular allaqachon qisman
 * sotilgan/ko'chirilgan bo'lsa - xuddi bekor qilishdagi kabi xato beradi,
 * chunki tahrirlash ham stokni orqaga qaytarishni talab qiladi), keyin
 * eski yozuvlar o'chirilib, yangi qiymatlar bilan xuddi createPurchase kabi
 * qayta yaratiladi - lekin xaridning ID'si va to'lov holati (paidAmountUzs)
 * saqlanib qoladi.
 */
export async function updatePurchase(id: string, input: UpdatePurchaseInput) {
  if (input.items.length === 0) throw new Error("Xaridda kamida bitta mahsulot bo'lishi kerak");

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    const existing = await tx.query.purchases.findFirst({
      where: eq(purchases.id, id),
      with: { items: true },
    });
    if (!existing) throw new Error("Xarid topilmadi");
    if (existing.cancelledAt) throw new Error("Bekor qilingan xaridni tahrirlab bo'lmaydi");
    if (!existing.warehouseId) throw new Error("Xaridning ombori aniqlanmagan, tahrirlab bo'lmaydi");

    // 1) Eski itemlar yaratgan partiyalarni "retire" qilamiz - agar allaqachon
    // ishlatilgan (sotilgan/ko'chirilgan) bo'lsa, shu yerda xato chiqadi.
    await cancelLotsForCreation(tx, { purchaseId: id, reason: "Tahrirlash uchun almashtirildi" });

    // 2) Eski itemlar bo'yicha kesh (product_stock)ni orqaga qaytaramiz.
    for (const item of existing.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      await adjustWarehouseStock(tx, {
        productId: item.productId,
        warehouseId: existing.warehouseId,
        type: "out",
        quantity: Number(item.quantity),
        priceUzs: null,
        unitLabel: product?.unit ?? "kg",
      });
      await recomputeProductAggregate(tx, item.productId);
    }

    // 3) Eski yozuvlarni tozalaymiz (bu xaridga tegishli purchaseItems va
    // "purchase" manbali stock_movements) - yangilari pastda yaratiladi.
    await tx.delete(purchaseItems).where(eq(purchaseItems.purchaseId, id));
    await tx
      .delete(stockMovements)
      .where(and(eq(stockMovements.purchaseId, id), eq(stockMovements.source, "purchase")));

    // 4) Yangi itemlarni createPurchase'dagi bilan bir xil mantiqda qo'shamiz.
    let totalAmount = 0;
    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      landedCostUzsSnapshot: string;
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      const subtotal = item.quantity * item.unitPrice;
      const subtotalUzs = input.currency === "USD" ? subtotal * rate : subtotal;
      totalAmount += subtotal;
      const landedCostUzs = subtotalUzs / item.quantity;

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
        landedCostUzsSnapshot: String(landedCostUzs),
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    const totalAmountUzs = input.currency === "USD" ? totalAmount * rate : totalAmount;
    const paidAmountUzs = Number(existing.paidAmountUzs);

    const [updated] = await tx
      .update(purchases)
      .set({
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        vehicleNumber: input.vehicleNumber ?? null,
        purchaseDate: input.purchaseDate ?? existing.purchaseDate,
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        totalAmount: String(totalAmount),
        totalAmountUzs: String(totalAmountUzs),
        paymentStatus: paymentStatusFor(paidAmountUzs, totalAmountUzs),
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, id))
      .returning();
    if (!updated) throw new Error("Xaridni yangilab bo'lmadi");

    await tx.insert(purchaseItems).values(itemRows.map((r) => ({ ...r, purchaseId: id })));

    for (const row of itemRows) {
      await createLot(tx, {
        productId: row.productId,
        warehouseId: input.warehouseId,
        unitCostUzs: Number(row.landedCostUzsSnapshot),
        quantity: Number(row.quantity),
        source: "purchase",
        purchaseId: id,
        receivedAt: input.purchaseDate ?? existing.purchaseDate,
      });
    }

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
        purchaseId: id,
        vehicleNumber: input.vehicleNumber ?? null,
        movementDate: input.purchaseDate ?? existing.purchaseDate,
      }))
    );

    return updated;
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

    // Partiya darajasidagi tekshiruv AVVAL: agar bu xariddan kelgan mahsulot
    // allaqachon qisman/to'liq sotilgan/ko'chirilgan bo'lsa, shu yerda aniq
    // xato bilan to'xtaydi (butun tranzaksiya bekor bo'ladi).
    await cancelLotsForCreation(tx, { purchaseId: purchase.id, reason });

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
