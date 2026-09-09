import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { products, sales, saleItems, stockMovements, payments } from "../../db/schema";
import { getCurrentRate } from "../settings/service";
import { assertDayOpenForSales } from "../day-closings/service";
import {
  adjustWarehouseStock,
  recomputeProductAggregate,
  consumeLotsFifo,
  recordConsumptions,
  reverseConsumptions,
} from "../stock/service";

type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  freightCostUzs?: number | null; // yuk puli (tashish xarajati), doim UZS, ixtiyoriy
  // Qaysi partiyadan (narxdan) sotilsin - berilmasa avtomatik FIFO (eng
  // eskisidan, kerak bo'lsa bir nechtasini birlashtirib).
  lotId?: string | null;
};

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
  await assertDayOpenForSales();

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    let totalAmount = 0; // mahsulotlar summasi, savdo valyutasida (yuk pulisiz)
    let freightTotalUzs = 0; // barcha qatorlar bo'yicha yuk puli yig'indisi (doim UZS)

    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      costPriceUzsSnapshot: string;
      freightCostUzs: string;
      consumptions: { lotId: string; quantity: number; unitCostUzs: number }[];
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      let consumption: Awaited<ReturnType<typeof consumeLotsFifo>>;
      try {
        // Eng eski (FIFO) faol partiyalardan yechiladi - shu partiyaning o'z
        // (hech qachon o'zgarmagan) narxi costPriceUzsSnapshot bo'ladi, endi
        // yangi narxda kirim qilingan boshqa mahsulot bunga ta'sir qilmaydi.
        consumption = await consumeLotsFifo(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          quantity: item.quantity,
          unitLabel: product.unit,
          lotId: item.lotId,
        });
        await adjustWarehouseStock(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          type: "out",
          quantity: item.quantity,
          priceUzs: null,
          unitLabel: product.unit,
        });
      } catch (err) {
        throw new Error(`"${product.name}": ${(err as Error).message}`);
      }

      const subtotal = item.quantity * item.unitPrice;
      const freightCostUzs = item.freightCostUzs ?? 0;
      totalAmount += subtotal;
      freightTotalUzs += freightCostUzs;

      itemRows.push({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        subtotal: String(subtotal),
        costPriceUzsSnapshot: String(consumption.weightedUnitCostUzs),
        freightCostUzs: String(freightCostUzs),
        consumptions: consumption.consumptions,
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    // Umumiy qarz (totalAmountUzs) = mahsulotlar summasi (UZS'ga o'girilgan) + yuk puli yig'indisi.
    const totalAmountUzs = (input.currency === "USD" ? totalAmount * rate : totalAmount) + freightTotalUzs;
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

    // Bittalab (bulk emas) - har bir qatorning ID'si darhol kerak
    // (stock_lot_consumptions shu ID bilan bog'lanadi).
    for (const row of itemRows) {
      const { consumptions, ...values } = row;
      const [savedItem] = await tx
        .insert(saleItems)
        .values({ ...values, saleId: sale.id })
        .returning();
      if (!savedItem) throw new Error("Savdo qatorini yaratib bo'lmadi");
      await recordConsumptions(tx, consumptions, { saleItemId: savedItem.id });
    }

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

/**
 * Mavjud savdoni tahrirlaydi (miqdor, narx, mahsulot, ombor va h.k.) -
 * foydalanuvchi so'roviga ko'ra bu yerda "immutable ledger" qoidasidan
 * ATAYLAB voz kechilgan. Avval eski itemlarning FIFO iste'moli qaytariladi
 * (aynan o'sha partiyalarga - reverseConsumptions), keyin eski yozuvlar
 * o'chirilib, yangi qiymatlar bilan xuddi createSale kabi qayta yaratiladi -
 * lekin savdoning ID'si va to'lov holati (paidAmountUzs) saqlanib qoladi.
 */
export async function updateSale(id: string, input: CreateSaleInput) {
  if (input.items.length === 0) throw new Error("Savdoda kamida bitta mahsulot bo'lishi kerak");

  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    const existing = await tx.query.sales.findFirst({
      where: eq(sales.id, id),
      with: { items: true },
    });
    if (!existing) throw new Error("Savdo topilmadi");
    if (existing.cancelledAt) throw new Error("Bekor qilingan savdoni tahrirlab bo'lmaydi");
    if (!existing.warehouseId) throw new Error("Savdoning ombori aniqlanmagan, tahrirlab bo'lmaydi");

    // 1) Eski itemlar FIFO iste'molini aynan o'sha partiyalarga qaytaramiz.
    for (const item of existing.items) {
      await reverseConsumptions(tx, { saleItemId: item.id });
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      await adjustWarehouseStock(tx, {
        productId: item.productId,
        warehouseId: existing.warehouseId,
        type: "in",
        quantity: Number(item.quantity),
        priceUzs: Number(item.costPriceUzsSnapshot),
        unitLabel: product?.unit ?? "kg",
      });
      await recomputeProductAggregate(tx, item.productId);
    }

    // 2) Eski yozuvlarni tozalaymiz - yangilari pastda yaratiladi.
    await tx.delete(saleItems).where(eq(saleItems.saleId, id));
    await tx
      .delete(stockMovements)
      .where(and(eq(stockMovements.saleId, id), eq(stockMovements.source, "sale")));

    // 3) Yangi itemlarni createSale'dagi bilan bir xil mantiqda qo'shamiz.
    let totalAmount = 0;
    let freightTotalUzs = 0;
    const itemRows: {
      productId: string;
      quantity: string;
      unitPrice: string;
      subtotal: string;
      costPriceUzsSnapshot: string;
      freightCostUzs: string;
      consumptions: { lotId: string; quantity: number; unitCostUzs: number }[];
    }[] = [];

    for (const item of input.items) {
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      if (!product) throw new Error("Mahsulot topilmadi");

      let consumption: Awaited<ReturnType<typeof consumeLotsFifo>>;
      try {
        consumption = await consumeLotsFifo(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          quantity: item.quantity,
          unitLabel: product.unit,
          lotId: item.lotId,
        });
        await adjustWarehouseStock(tx, {
          productId: item.productId,
          warehouseId: input.warehouseId,
          type: "out",
          quantity: item.quantity,
          priceUzs: null,
          unitLabel: product.unit,
        });
      } catch (err) {
        throw new Error(`"${product.name}": ${(err as Error).message}`);
      }

      const subtotal = item.quantity * item.unitPrice;
      const freightCostUzs = item.freightCostUzs ?? 0;
      totalAmount += subtotal;
      freightTotalUzs += freightCostUzs;

      itemRows.push({
        productId: item.productId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        subtotal: String(subtotal),
        costPriceUzsSnapshot: String(consumption.weightedUnitCostUzs),
        freightCostUzs: String(freightCostUzs),
        consumptions: consumption.consumptions,
      });

      await recomputeProductAggregate(tx, item.productId);
    }

    const totalAmountUzs = (input.currency === "USD" ? totalAmount * rate : totalAmount) + freightTotalUzs;
    const paidAmountUzs = Number(existing.paidAmountUzs);

    const [updated] = await tx
      .update(sales)
      .set({
        partnerId: input.partnerId,
        warehouseId: input.warehouseId,
        vehicleNumber: input.vehicleNumber ?? null,
        saleDate: input.saleDate ?? existing.saleDate,
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        totalAmount: String(totalAmount),
        totalAmountUzs: String(totalAmountUzs),
        paymentStatus: paymentStatusFor(paidAmountUzs, totalAmountUzs),
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, id))
      .returning();
    if (!updated) throw new Error("Savdoni yangilab bo'lmadi");

    for (const row of itemRows) {
      const { consumptions, ...values } = row;
      const [savedItem] = await tx
        .insert(saleItems)
        .values({ ...values, saleId: id })
        .returning();
      if (!savedItem) throw new Error("Savdo qatorini yaratib bo'lmadi");
      await recordConsumptions(tx, consumptions, { saleItemId: savedItem.id });
    }

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
        saleId: id,
        vehicleNumber: input.vehicleNumber ?? null,
        movementDate: input.saleDate ?? existing.saleDate,
      }))
    );

    return updated;
  });
}

/**
 * Savdoni bekor qiladi (storno). Loyihadagi "immutable ledger" qoidasiga ko'ra
 * savdo/mahsulot yozuvlari o'chirilmaydi yoki tahrirlanmaydi - shuning uchun bu
 * funksiya sale_items/sales'ni o'zgartirmaydi, faqat:
 *  1) har bir mahsulot uchun omborga teskari (kirim, source="sale_reversal")
 *     yozuv qo'shib, mahsulotni qaytaradi (xuddi shu tannarx bilan - shunda
 *     og'irlikli o'rtacha tannarx o'zgarmay saqlanadi),
 *  2) sales jadvalida faqat cancelledAt/cancelReason/paymentStatus maydonlarini
 *     to'ldiradi (bu holat belgisi, moliyaviy summalar tegilmaydi).
 * Bekor qilingan savdo hisobot/balans so'rovlaridan chiqarib tashlanadi.
 */
export async function cancelSale(id: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const sale = await tx.query.sales.findFirst({
      where: eq(sales.id, id),
      with: { items: { with: { product: true } } },
    });
    if (!sale) throw new Error("Savdo topilmadi");
    if (sale.cancelledAt) throw new Error("Bu savdo allaqachon bekor qilingan");
    if (!sale.warehouseId) throw new Error("Savdoning ombori aniqlanmagan, bekor qilib bo'lmaydi");

    const rate = await getCurrentRate();

    for (const item of sale.items ?? []) {
      // Aynan o'sha (FIFO'da yechilgan) partiya(lar)ga qoldiqni qaytaradi -
      // yangi "blend" partiya yaratmaydi, shuning uchun qaysi partiya qachon
      // kelgani buzilmaydi.
      await reverseConsumptions(tx, { saleItemId: item.id });

      await adjustWarehouseStock(tx, {
        productId: item.productId,
        warehouseId: sale.warehouseId,
        type: "in",
        quantity: Number(item.quantity),
        priceUzs: Number(item.costPriceUzsSnapshot),
        unitLabel: item.product?.unit ?? "kg",
      });
      await recomputeProductAggregate(tx, item.productId);

      await tx.insert(stockMovements).values({
        productId: item.productId,
        type: "in",
        source: "sale_reversal",
        quantity: item.quantity,
        pricePerUnit: item.costPriceUzsSnapshot,
        currency: "UZS",
        exchangeRateSnapshot: String(rate),
        partnerId: sale.partnerId,
        warehouseId: sale.warehouseId,
        saleId: sale.id,
        vehicleNumber: sale.vehicleNumber,
        note: reason ? `Savdo bekor qilindi: ${reason}` : "Savdo bekor qilindi",
      });
    }

    const [updated] = await tx
      .update(sales)
      .set({
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
        paymentStatus: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(sales.id, id))
      .returning();

    return updated;
  });
}

export async function listSales(filters: {
  partnerId?: string;
  paymentStatus?: "paid" | "partial" | "credit" | "cancelled";
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
    with: { partner: true, warehouse: true, items: { with: { product: true } } },
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
