import { eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { products, productStock } from "../../db/schema";

export async function listProducts() {
  return db.select().from(products).where(isNull(products.archivedAt)).orderBy(products.name);
}

/** Arxivlangan (o'chirilgan) mahsulotlar - "Arxiv" sahifasi uchun. */
export async function listArchivedProducts() {
  return db.select().from(products).where(isNotNull(products.archivedAt)).orderBy(products.name);
}

export async function getProduct(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  return product;
}

export async function createProduct(data: {
  name: string;
  unit: "kg" | "ton";
  minStockAlert?: string | null;
  sellingPriceUzs?: string | null;
  notes?: string | null;
}) {
  const [product] = await db.insert(products).values(data).returning();
  return product;
}

/**
 * Mahsulotni yangilaydi. `avgCostUzs` berilsa (tan narxni qo'lda to'g'irlash -
 * masalan xato kiritilgan bo'lsa), bu qiymat nafaqat `products` jadvaliga,
 * balki shu mahsulotning **barcha omborlardagi** `product_stock` qatorlariga
 * ham yoziladi. Sabab: `products.avgCostUzs` aslida `product_stock`dan
 * hisoblangan tayyor yig'indi - agar faqat shu yerga yozilsa, keyingi
 * kirim/chiqim/xarid operatsiyasida `recomputeProductAggregate()` uni
 * jimgina eski (noto'g'ri) qiymatga qaytarib qo'yar edi.
 */
export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    unit: "kg" | "ton";
    minStockAlert: string | null;
    sellingPriceUzs: string | null;
    avgCostUzs: string;
    notes: string | null;
  }>
) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (data.avgCostUzs != null) {
      await tx
        .update(productStock)
        .set({ avgCostUzs: data.avgCostUzs, updatedAt: new Date() })
        .where(eq(productStock.productId, id));
    }

    return product;
  });
}

/**
 * Mahsulotni "o'chiradi" - haqiqatda yozuv o'chirilmaydi, faqat arxivga
 * o'tkaziladi (archivedAt to'ldiriladi). Shunday qilinishining sababi: bu
 * mahsulotga tarixiy kirim-chiqim/savdo/xarid yozuvlari bog'langan bo'lishi
 * mumkin - ular buzilib qolmasligi kerak. Arxiv sahifasidan tiklash mumkin.
 */
export async function deleteProduct(id: string) {
  await db.update(products).set({ archivedAt: new Date() }).where(eq(products.id, id));
}

export async function restoreProduct(id: string) {
  const [product] = await db
    .update(products)
    .set({ archivedAt: null })
    .where(eq(products.id, id))
    .returning();
  return product;
}
