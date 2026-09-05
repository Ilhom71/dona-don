import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { products, stockMovements, productStock } from "../../db/schema";
import { getCurrentRate } from "../settings/service";

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

    await adjustWarehouseStock(tx, {
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

    const outResult = await adjustWarehouseStock(tx, {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      type: "out",
      quantity: input.quantity,
      priceUzs: null,
      unitLabel: product.unit,
    });

    await adjustWarehouseStock(tx, {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      type: "in",
      quantity: input.quantity,
      priceUzs: outResult.previousCostUzs,
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
        pricePerUnit: String(outResult.previousCostUzs),
        currency: "UZS",
        exchangeRateSnapshot: String(rate),
        warehouseId: input.fromWarehouseId,
        transferGroupId,
        vehicleNumber: input.vehicleNumber ?? null,
        note: input.note ?? null,
        movementDate: date,
      })
      .returning();

    await tx.insert(stockMovements).values({
      productId: input.productId,
      type: "in",
      source: "transfer",
      quantity: String(input.quantity),
      pricePerUnit: String(outResult.previousCostUzs),
      currency: "UZS",
      exchangeRateSnapshot: String(rate),
      warehouseId: input.toWarehouseId,
      transferGroupId,
      vehicleNumber: input.vehicleNumber ?? null,
      note: input.note ?? null,
      movementDate: date,
    });

    return outMovement;
  });
}

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

  return db
    .select()
    .from(stockMovements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stockMovements.movementDate));
}

/** Har bir mahsulotning har omborda qancha qoldig'i borligini ko'rsatadi. */
export async function listProductStock(filters: { productId?: string; warehouseId?: string }) {
  const conditions = [];
  if (filters.productId) conditions.push(eq(productStock.productId, filters.productId));
  if (filters.warehouseId) conditions.push(eq(productStock.warehouseId, filters.warehouseId));

  return db.query.productStock.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { product: true, warehouse: true },
  });
}
