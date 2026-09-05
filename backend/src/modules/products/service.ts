import { eq } from "drizzle-orm";
import { db } from "../../db";
import { products } from "../../db/schema";

export async function listProducts() {
  return db.select().from(products).orderBy(products.name);
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

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    unit: "kg" | "ton";
    minStockAlert: string | null;
    sellingPriceUzs: string | null;
    notes: string | null;
  }>
) {
  const [product] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return product;
}

export async function deleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
}
