import { and, asc, desc, eq, gt, gte, isNull, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  products,
  stockMovements,
  productStock,
  sales,
  purchases,
  partners,
  warehouses,
  stockLots,
  stockLotConsumptions,
} from "../../db/schema";
import { getCurrentRate } from "../settings/service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateMovementInput = {
  productId: string;
  type: "in" | "out";
  quantity: number;
  pricePerUnit?: number | null;
  currency: "UZS" | "USD";
  partnerId?: string | null;
  warehouseId: string;
  vehicleNumber?: string | null;
  note?: string | null;
  movementDate?: Date;
};

/**
 * Bitta ombordagi mahsulot qoldig'ini (product_stock) kirim/chiqimga qarab
 * yangilaydi. Kirimda og'irlikli o'rtacha tannarx qayta hisoblanadi, chiqimda
 * faqat miqdor kamayadi (qolgan qoldiqning tannarxi o'zgarmaydi).
 * Chaqiruvchi funksiya buni tranzaksiya ichida chaqirishi va keyin
 * recomputeProductAggregate() bilan mahsulotning umumiy (barcha ombor) holatini
 * yangilashi kerak.
 */
export async function adjustWarehouseStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    productId: string;
    warehouseId: string;
    type: "in" | "out";
    quantity: number;
    priceUzs: number | null;
    unitLabel: string;
  }
) {
  let [row] = await tx
    .select()
    .from(productStock)
    .where(
      and(eq(productStock.productId, params.productId), eq(productStock.warehouseId, params.warehouseId))
    )
    .for("update");

  if (!row) {
    [row] = await tx
      .insert(productStock)
      .values({ productId: params.productId, warehouseId: params.warehouseId, quantity: "0", avgCostUzs: "0" })
      .returning();
  }
  if (!row) throw new Error("Ombor qoldig'i yozuvini yaratib bo'lmadi");

  const currentQty = Number(row.quantity);
  const currentCost = Number(row.avgCostUzs);
  let newQty = currentQty;
  let newCost = currentCost;

  if (params.type === "in") {
    newQty = currentQty + params.quantity;
    if (params.priceUzs != null) {
      newCost =
        newQty > 0 ? (currentQty * currentCost + params.quantity * params.priceUzs) / newQty : params.priceUzs;
    }
  } else {
    if (params.quantity > currentQty) {
      throw new Error(
        `Bu omborda yetarli mahsulot yo'q. Qoldiq: ${currentQty} ${params.unitLabel}`
      );
    }
    newQty = currentQty - params.quantity;
  }

  await tx
    .update(productStock)
    .set({ quantity: String(newQty), avgCostUzs: String(newCost), updatedAt: new Date() })
    .where(eq(productStock.id, row.id));

  return { previousCostUzs: currentCost, newQuantity: newQty, newCostUzs: newCost };
}

/** Mahsulotning barcha omborlar bo'yicha umumiy qoldig'i/tannarxini product_stock'dan qayta hisoblaydi. */
export async function recomputeProductAggregate(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string
) {
  const rows = await tx.select().from(productStock).where(eq(productStock.productId, productId));
  const totalQty = rows.reduce((sum, r) => sum + Number(r.quantity), 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.quantity) * Number(r.avgCostUzs), 0);
  const avgCost = totalQty > 0 ? totalValue / totalQty : 0;
  await tx
    .update(products)
    .set({ stockQuantity: String(totalQty), avgCostUzs: String(avgCost), updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ---------- FIFO partiya (lot) kitobi ----------
// product_stock.avgCostUzs (yuqorida) faqat KO'RSATISH/baholash uchun
// og'irlikli o'rtacha bo'lib qolaveradi. Haqiqiy sotuv tannarxi (COGS) endi
// shu yerdagi partiyalardan FIFO tartibida olinadi - shunda yangi narxda
// kirim qilingan mahsulot eski partiyaning (hali sotilmagan qoldiqning)
// tannarxiga ta'sir qilmaydi.

/** Yangi partiya yaratadi (xarid/qo'lda kirim/transfer-kirim). */
export async function createLot(
  tx: Tx,
  params: {
    productId: string;
    warehouseId: string;
    unitCostUzs: number;
    quantity: number;
    source: "purchase" | "manual" | "transfer";
    purchaseId?: string | null;
    movementId?: string | null;
    receivedAt: Date;
  }
) {
  const [lot] = await tx
    .insert(stockLots)
    .values({
      productId: params.productId,
      warehouseId: params.warehouseId,
      unitCostUzs: String(params.unitCostUzs),
      quantity: String(params.quantity),
      remainingQuantity: String(params.quantity),
      source: params.source,
      purchaseId: params.purchaseId ?? null,
      movementId: params.movementId ?? null,
      receivedAt: params.receivedAt,
    })
    .returning();
  if (!lot) throw new Error("Partiya yozuvini yaratib bo'lmadi");
  return lot;
}

/**
 * Berilgan mahsulot/ombor uchun eng eski (receivedAt) faol partiyalardan
 * navbat bilan (FIFO) yechadi - bir nechtasidan yechilsa, natijaviy
 * og'irlikli o'rtacha narx (weightedUnitCostUzs) qaytariladi (savdo
 * qatorining costPriceUzsSnapshot'iga yoziladi). Agar `lotId` berilsa,
 * FIFO'ni chetlab, faqat o'sha bitta (foydalanuvchi qo'lda tanlagan)
 * partiyadan yechiladi - masalan savdoda "qaysi narxdagi partiyadan
 * sotilsin" deb aniq tanlanganda.
 */
export async function consumeLotsFifo(
  tx: Tx,
  params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    unitLabel?: string;
    lotId?: string | null;
  }
) {
  const conditions = [
    eq(stockLots.productId, params.productId),
    eq(stockLots.warehouseId, params.warehouseId),
    isNull(stockLots.cancelledAt),
    gt(stockLots.remainingQuantity, "0"),
  ];
  if (params.lotId) conditions.push(eq(stockLots.id, params.lotId));

  const lots = await tx
    .select()
    .from(stockLots)
    .where(and(...conditions))
    .orderBy(asc(stockLots.receivedAt), asc(stockLots.createdAt))
    .for("update");

  const totalAvailable = lots.reduce((sum, l) => sum + Number(l.remainingQuantity), 0);
  if (params.quantity > totalAvailable) {
    const label = params.lotId ? "Bu partiyada" : "Bu omborda";
    throw new Error(
      `${label} yetarli mahsulot yo'q. Qoldiq: ${totalAvailable} ${params.unitLabel ?? ""}`.trim()
    );
  }

  let remaining = params.quantity;
  const consumptions: { lotId: string; quantity: number; unitCostUzs: number }[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const lotRemaining = Number(lot.remainingQuantity);
    const take = Math.min(lotRemaining, remaining);
    if (take <= 0) continue;
    await tx
      .update(stockLots)
      .set({ remainingQuantity: String(lotRemaining - take) })
      .where(eq(stockLots.id, lot.id));
    consumptions.push({ lotId: lot.id, quantity: take, unitCostUzs: Number(lot.unitCostUzs) });
    remaining -= take;
  }

  const totalCostUzs = consumptions.reduce((sum, c) => sum + c.quantity * c.unitCostUzs, 0);
  const weightedUnitCostUzs = params.quantity > 0 ? totalCostUzs / params.quantity : 0;

  return { consumptions, weightedUnitCostUzs, totalCostUzs };
}

/** `consumeLotsFifo` natijasini `stock_lot_consumptions`ga yozadi (savdo qatori yoki qo'lda/transfer chiqim yozuvi bilan bog'lab). */
export async function recordConsumptions(
  tx: Tx,
  consumptions: { lotId: string; quantity: number; unitCostUzs: number }[],
  link: { saleItemId?: string; movementId?: string }
) {
  if (consumptions.length === 0) return;
  await tx.insert(stockLotConsumptions).values(
    consumptions.map((c) => ({
      lotId: c.lotId,
      quantity: String(c.quantity),
      unitCostUzs: String(c.unitCostUzs),
      saleItemId: link.saleItemId ?? null,
      movementId: link.movementId ?? null,
    }))
  );
}

function consumptionCondition(params: { saleItemId?: string; movementId?: string }) {
  if (params.saleItemId) return eq(stockLotConsumptions.saleItemId, params.saleItemId);
  if (params.movementId) return eq(stockLotConsumptions.movementId, params.movementId);
  return undefined;
}

/** Savdo/qo'lda chiqim bekor qilinganda - o'sha aniq partiya(lar)ga qoldiqni qaytaradi. */
export async function reverseConsumptions(
  tx: Tx,
  params: { saleItemId?: string; movementId?: string }
) {
  const condition = consumptionCondition(params);
  if (!condition) return;

  const rows = await tx.select().from(stockLotConsumptions).where(condition);
  for (const row of rows) {
    const [lot] = await tx.select().from(stockLots).where(eq(stockLots.id, row.lotId)).for("update");
    if (!lot) continue;
    await tx
      .update(stockLots)
      .set({ remainingQuantity: String(Number(lot.remainingQuantity) + Number(row.quantity)) })
      .where(eq(stockLots.id, lot.id));
  }
}

/** Bekor qilingan yozuv tiklanganda - o'sha aniq partiya(lar)dan xuddi shu miqdorni qayta yechadi. */
export async function replayConsumptions(
  tx: Tx,
  params: { saleItemId?: string; movementId?: string }
) {
  const condition = consumptionCondition(params);
  if (!condition) return;

  const rows = await tx.select().from(stockLotConsumptions).where(condition);
  for (const row of rows) {
    const [lot] = await tx.select().from(stockLots).where(eq(stockLots.id, row.lotId)).for("update");
    if (!lot) continue;
    const remaining = Number(lot.remainingQuantity);
    const need = Number(row.quantity);
    if (need > remaining) {
      throw new Error(
        `Tiklab bo'lmaydi: partiyada endi yetarli qoldiq yo'q (kerak ${need}, mavjud ${remaining})`
      );
    }
    await tx
      .update(stockLots)
      .set({ remainingQuantity: String(remaining - need) })
      .where(eq(stockLots.id, lot.id));
  }
}

/**
 * Xarid/qo'lda kirim bekor qilinganda shu operatsiya yaratgan partiya(lar)ni
 * bekor qiladi. Agar partiya allaqachon qisman/to'liq ishlatilgan (sotilgan/
 * ko'chirilgan) bo'lsa - xato qaytaradi (bekor qilib bo'lmaydi).
 */
export async function cancelLotsForCreation(
  tx: Tx,
  params: { purchaseId?: string; movementId?: string; reason?: string | null }
) {
  const condition = params.purchaseId
    ? eq(stockLots.purchaseId, params.purchaseId)
    : params.movementId
      ? eq(stockLots.movementId, params.movementId)
      : undefined;
  if (!condition) return;

  const lots = await tx.select().from(stockLots).where(condition).for("update");
  for (const lot of lots) {
    if (lot.cancelledAt) continue;
    if (Number(lot.remainingQuantity) !== Number(lot.quantity)) {
      throw new Error("Bu mahsulot allaqachon ishlatilgan (sotilgan/ko'chirilgan), bekor qilib bo'lmaydi");
    }
  }
  for (const lot of lots) {
    if (lot.cancelledAt) continue;
    await tx
      .update(stockLots)
      .set({ remainingQuantity: "0", cancelledAt: new Date(), cancelReason: params.reason ?? null })
      .where(eq(stockLots.id, lot.id));
  }
}

/** Faqat qo'lda kiritilgan kirim yozuvi tiklanganda - shu yozuv yaratgan partiyani qayta faollashtiradi. */
export async function restoreLotsForCreation(tx: Tx, params: { movementId: string }) {
  const lots = await tx.select().from(stockLots).where(eq(stockLots.movementId, params.movementId)).for("update");
  for (const lot of lots) {
    if (!lot.cancelledAt) continue;
    await tx
      .update(stockLots)
      .set({ remainingQuantity: lot.quantity, cancelledAt: null, cancelReason: null })
      .where(eq(stockLots.id, lot.id));
  }
}

/**
 * Ombor kirim/chiqimini yozib, o'sha ombordagi qoldiqni va mahsulotning umumiy
 * (barcha ombor) qoldig'ini bitta tranzaksiya ichida yangilaydi. Yozuvlar
 * keyinchalik o'zgartirilmaydi - xato bo'lsa, teskari operatsiya kiritiladi.
 */
export async function createMovement(input: CreateMovementInput) {
  const rate = await getCurrentRate();

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, input.productId));
    if (!product) throw new Error("Mahsulot topilmadi");

    const priceUzs =
      input.pricePerUnit != null
        ? input.currency === "USD"
          ? input.pricePerUnit * rate
          : input.pricePerUnit
        : null;

    let consumption: Awaited<ReturnType<typeof consumeLotsFifo>> | null = null;
    if (input.type === "out") {
      // Partiyalarni AVVAL yechamiz (yetarli bo'lmasa shu yerda aniq partiya
      // darajasida xato chiqadi) - keyin keshni (product_stock) yangilaymiz.
      try {
        consumption = await consumeLotsFifo(tx, {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          unitLabel: product.unit,
        });
      } catch (err) {
        throw new Error(`"${product.name}": ${(err as Error).message}`);
      }
    }

    const adjustResult = await adjustWarehouseStock(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: input.quantity,
      priceUzs,
      unitLabel: product.unit,
    });
    await recomputeProductAggregate(tx, input.productId);

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: input.productId,
        type: input.type,
        source: "manual",
        quantity: String(input.quantity),
        pricePerUnit: input.pricePerUnit != null ? String(input.pricePerUnit) : null,
        currency: input.currency,
        exchangeRateSnapshot: String(rate),
        partnerId: input.partnerId ?? null,
        warehouseId: input.warehouseId,
        vehicleNumber: input.vehicleNumber ?? null,
        note: input.note ?? null,
        movementDate: input.movementDate ?? new Date(),
      })
      .returning();

    if (!movement) throw new Error("Kirim-chiqim yozuvini yaratib bo'lmadi");

    if (input.type === "in") {
      await createLot(tx, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        unitCostUzs: priceUzs ?? adjustResult.previousCostUzs,
        quantity: input.quantity,
        source: "manual",
        movementId: movement.id,
        receivedAt: input.movementDate ?? new Date(),
      });
    } else if (consumption) {
      await recordConsumptions(tx, consumption.consumptions, { movementId: movement.id });
    }

    return movement;
  });
}

type CreateTransferInput = {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  vehicleNumber?: string | null;
  note?: string | null;
  movementDate?: Date;
};

/**
 * Bitta mahsulotni bir ombordan ikkinchisiga ko'chiradi: manba ombordan
 * kamaytiradi, maqsad omborga o'sha tannarx bilan qo'shadi (transfer qiymat
 * yaratmaydi/yo'qotmaydi), va ikkalasini bog'lovchi chiqim+kirim yozuvlarini
 * yaratadi. Mahsulotning umumiy qoldig'i o'zgarmaydi.
 */
export async function createTransfer(input: CreateTransferInput) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Manba va maqsad ombor bir xil bo'lishi mumkin emas");
  }

  const rate = await getCurrentRate();
  const transferGroupId = crypto.randomUUID();
  const date = input.movementDate ?? new Date();

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, input.productId));
    if (!product) throw new Error("Mahsulot topilmadi");

    // Manba ombordagi partiyalardan FIFO tartibida yechamiz - shu orqali
    // maqsad omborga aynan qancha narxda ko'chirilgani (bir nechta partiyadan
    // aralashgan bo'lsa - og'irlikli o'rtachasi) aniqlanadi.
    const consumption = await consumeLotsFifo(tx, {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      quantity: input.quantity,
      unitLabel: product.unit,
    });

    await adjustWarehouseStock(tx, {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      type: "out",
      quantity: input.quantity,
      priceUzs: null,
      unitLabel: product.unit,
    });

    // Maqsad omborga - manbadan aynan FIFO tartibida yechilgan partiyalarning
    // haqiqiy narxi bilan (kesh o'rtachasi emas - agar manba omborda bir
    // nechta narxdagi partiya bo'lsa, ular boshqacha bo'lishi mumkin edi).
    await adjustWarehouseStock(tx, {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      type: "in",
      quantity: input.quantity,
      priceUzs: consumption.weightedUnitCostUzs,
      unitLabel: product.unit,
    });

    // Umumiy qoldiq o'zgarmaydi (bir ombordan ikkinchisiga ko'chdi, xolos),
    // lekin tannarx qayta hisoblanishi mumkin bo'lgani uchun yangilab qo'yamiz.
    await recomputeProductAggregate(tx, input.productId);

    const [outMovement] = await tx
      .insert(stockMovements)
      .values({
        productId: input.productId,
        type: "out",
        source: "transfer",
        quantity: String(input.quantity),
        pricePerUnit: String(consumption.weightedUnitCostUzs),
        currency: "UZS",
        exchangeRateSnapshot: String(rate),
        warehouseId: input.fromWarehouseId,
        transferGroupId,
        vehicleNumber: input.vehicleNumber ?? null,
        note: input.note ?? null,
        movementDate: date,
      })
      .returning();
    if (!outMovement) throw new Error("Transfer yozuvini yaratib bo'lmadi");

    await recordConsumptions(tx, consumption.consumptions, { movementId: outMovement.id });

    const [inMovement] = await tx
      .insert(stockMovements)
      .values({
        productId: input.productId,
        type: "in",
        source: "transfer",
        quantity: String(input.quantity),
        pricePerUnit: String(consumption.weightedUnitCostUzs),
        currency: "UZS",
        exchangeRateSnapshot: String(rate),
        warehouseId: input.toWarehouseId,
        transferGroupId,
        vehicleNumber: input.vehicleNumber ?? null,
        note: input.note ?? null,
        movementDate: date,
      })
      .returning();
    if (!inMovement) throw new Error("Transfer yozuvini yaratib bo'lmadi");

    // Maqsad omborga - manbadan yechilgan partiyalarning haqiqiy (FIFO)
    // og'irlikli o'rtacha narxi bilan yangi partiya.
    await createLot(tx, {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      unitCostUzs: consumption.weightedUnitCostUzs,
      quantity: input.quantity,
      source: "transfer",
      movementId: inMovement.id,
      receivedAt: date,
    });

    return outMovement;
  });
}

/**
 * Har bir yozuv uchun `cancelled` bayrog'ini ham qo'shadi: "manual" yozuvlar
 * o'zining cancelledAt'iga, "sale"/"sale_reversal" va "purchase"/
 * "purchase_reversal" yozuvlar esa bog'liq savdo/xarid bekor qilinganiga
 * qarab aniqlanadi (ular alohida bekor qilinmaydi - manba orqali boshqariladi).
 */
export async function listMovements(filters: {
  productId?: string;
  type?: "in" | "out";
  warehouseId?: string;
  from?: Date;
  to?: Date;
}) {
  const conditions = [];
  if (filters.productId) conditions.push(eq(stockMovements.productId, filters.productId));
  if (filters.type) conditions.push(eq(stockMovements.type, filters.type));
  if (filters.warehouseId) conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
  if (filters.from) conditions.push(gte(stockMovements.movementDate, filters.from));
  if (filters.to) conditions.push(lte(stockMovements.movementDate, filters.to));

  const rows = await db
    .select({
      id: stockMovements.id,
      productId: stockMovements.productId,
      type: stockMovements.type,
      source: stockMovements.source,
      quantity: stockMovements.quantity,
      pricePerUnit: stockMovements.pricePerUnit,
      currency: stockMovements.currency,
      exchangeRateSnapshot: stockMovements.exchangeRateSnapshot,
      partnerId: stockMovements.partnerId,
      saleId: stockMovements.saleId,
      purchaseId: stockMovements.purchaseId,
      warehouseId: stockMovements.warehouseId,
      transferGroupId: stockMovements.transferGroupId,
      vehicleNumber: stockMovements.vehicleNumber,
      note: stockMovements.note,
      cancelledAt: stockMovements.cancelledAt,
      cancelReason: stockMovements.cancelReason,
      movementDate: stockMovements.movementDate,
      createdAt: stockMovements.createdAt,
      saleCancelledAt: sales.cancelledAt,
      purchaseCancelledAt: purchases.cancelledAt,
    })
    .from(stockMovements)
    .leftJoin(sales, eq(stockMovements.saleId, sales.id))
    .leftJoin(purchases, eq(stockMovements.purchaseId, purchases.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stockMovements.movementDate));

  return rows.map((r) => ({
    ...r,
    cancelled: !!r.cancelledAt || !!r.saleCancelledAt || !!r.purchaseCancelledAt,
  }));
}

/**
 * Qo'lda kiritilgan ("manual") kirim/chiqim yozuvini bekor qiladi - yozuv
 * o'chirilmaydi, faqat qoldiq teskari yo'nalishda qaytariladi va
 * cancelledAt/cancelReason to'ldiriladi. Faqat "manual" manbali yozuvlar
 * uchun ishlaydi - savdo/xarid orqali yaratilgan yozuvlar o'z manba
 * operatsiyasi (savdo/xarid) bekor qilinganda avtomatik hisobga olinadi.
 */
export async function cancelMovement(id: string, reason?: string | null) {
  return db.transaction(async (tx) => {
    const [movement] = await tx.select().from(stockMovements).where(eq(stockMovements.id, id));
    if (!movement) throw new Error("Yozuv topilmadi");
    if (movement.source !== "manual") {
      throw new Error("Faqat qo'lda kiritilgan yozuvlarni bekor qilish mumkin");
    }
    if (movement.cancelledAt) throw new Error("Bu yozuv allaqachon bekor qilingan");
    if (!movement.warehouseId) throw new Error("Yozuvning ombori aniqlanmagan, bekor qilib bo'lmaydi");

    const [product] = await tx.select().from(products).where(eq(products.id, movement.productId));
    if (!product) throw new Error("Mahsulot topilmadi");

    // Teskari yo'nalish: "kirim" bo'lgan bo'lsa endi ayiramiz, "chiqim" bo'lgan
    // bo'lsa qaytadan qo'shamiz (o'sha narx bilan, agar bo'lsa).
    const reverseType = movement.type === "in" ? "out" : "in";
    const priceUzs =
      reverseType === "in" && movement.pricePerUnit != null
        ? movement.currency === "USD"
          ? Number(movement.pricePerUnit) * Number(movement.exchangeRateSnapshot)
          : Number(movement.pricePerUnit)
        : null;

    // Partiya darajasidagi tekshiruv/bekor qilish - kesh (product_stock)
    // yangilanishidan OLDIN, chunki bu qattiqroq/aniqroq gate.
    if (movement.type === "in") {
      await cancelLotsForCreation(tx, { movementId: movement.id, reason });
    } else {
      await reverseConsumptions(tx, { movementId: movement.id });
    }

    await adjustWarehouseStock(tx, {
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      type: reverseType,
      quantity: Number(movement.quantity),
      priceUzs,
      unitLabel: product.unit,
    });
    await recomputeProductAggregate(tx, movement.productId);

    const [updated] = await tx
      .update(stockMovements)
      .set({ cancelledAt: new Date(), cancelReason: reason ?? null })
      .where(eq(stockMovements.id, id))
      .returning();
    return updated;
  });
}

export async function restoreMovement(id: string) {
  return db.transaction(async (tx) => {
    const [movement] = await tx.select().from(stockMovements).where(eq(stockMovements.id, id));
    if (!movement) throw new Error("Yozuv topilmadi");
    if (!movement.cancelledAt) throw new Error("Bu yozuv bekor qilinmagan");
    if (!movement.warehouseId) throw new Error("Yozuvning ombori aniqlanmagan, tiklab bo'lmaydi");

    const [product] = await tx.select().from(products).where(eq(products.id, movement.productId));
    if (!product) throw new Error("Mahsulot topilmadi");

    // Asl yo'nalishni qaytadan qo'llaymiz (bekor qilishning teskarisi).
    const priceUzs =
      movement.type === "in" && movement.pricePerUnit != null
        ? movement.currency === "USD"
          ? Number(movement.pricePerUnit) * Number(movement.exchangeRateSnapshot)
          : Number(movement.pricePerUnit)
        : null;

    if (movement.type === "in") {
      await restoreLotsForCreation(tx, { movementId: movement.id });
    } else {
      await replayConsumptions(tx, { movementId: movement.id });
    }

    await adjustWarehouseStock(tx, {
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      type: movement.type,
      quantity: Number(movement.quantity),
      priceUzs,
      unitLabel: product.unit,
    });
    await recomputeProductAggregate(tx, movement.productId);

    const [updated] = await tx
      .update(stockMovements)
      .set({ cancelledAt: null, cancelReason: null })
      .where(eq(stockMovements.id, id))
      .returning();
    return updated;
  });
}

/** Har bir mahsulotning har omborda qancha qoldig'i borligini ko'rsatadi. */
export async function listProductStock(filters: { productId?: string; warehouseId?: string }) {
  const conditions = [];
  if (filters.productId) conditions.push(eq(productStock.productId, filters.productId));
  if (filters.warehouseId) conditions.push(eq(productStock.warehouseId, filters.warehouseId));

  const rows = await db.query.productStock.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { product: true, warehouse: true },
  });

  // Arxivlangan (o'chirilgan) mahsulot YOKI ombor qoldig'i ombor
  // ko'rinishlarida ko'rsatilmaydi - boshqa "o'chirish" oqimlari bilan bir xil naqsh.
  return rows.filter((r) => !r.product?.archivedAt && !r.warehouse?.archivedAt);
}

/**
 * Har xil narxda kirim qilingan (masalan har xil hamkordan olingan)
 * bug'doyning har biri alohida "partiya" sifatida ko'rinishi uchun - faol
 * (hali sotilib tugamagan, bekor qilinmagan) partiyalarni eng eskisidan
 * boshlab qaytaradi. Yangi savdoda "qaysi partiyadan sotilsin" tanlovi va
 * Omborlar sahifasidagi narx bo'yicha ajratilgan qoldiq shu yerdan olinadi.
 */
export async function listActiveLots(filters: { productId?: string; warehouseId?: string }) {
  const conditions = [isNull(stockLots.cancelledAt), gt(stockLots.remainingQuantity, "0")];
  if (filters.productId) conditions.push(eq(stockLots.productId, filters.productId));
  if (filters.warehouseId) conditions.push(eq(stockLots.warehouseId, filters.warehouseId));

  return db
    .select({
      id: stockLots.id,
      productId: stockLots.productId,
      warehouseId: stockLots.warehouseId,
      unitCostUzs: stockLots.unitCostUzs,
      quantity: stockLots.quantity,
      remainingQuantity: stockLots.remainingQuantity,
      source: stockLots.source,
      receivedAt: stockLots.receivedAt,
      productName: products.name,
      unit: products.unit,
      warehouseName: warehouses.name,
      // Faqat xariddan kelgan partiyalarda bo'ladi - qaysi hamkordan olingani.
      supplierName: partners.name,
    })
    .from(stockLots)
    .innerJoin(products, eq(stockLots.productId, products.id))
    .innerJoin(warehouses, eq(stockLots.warehouseId, warehouses.id))
    .leftJoin(purchases, eq(stockLots.purchaseId, purchases.id))
    .leftJoin(partners, eq(purchases.partnerId, partners.id))
    .where(and(...conditions))
    .orderBy(asc(stockLots.receivedAt));
}
