import { eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { warehouses } from "../../db/schema";

export async function listWarehouses() {
  return db.select().from(warehouses).where(isNull(warehouses.archivedAt)).orderBy(warehouses.name);
}

/** Arxivlangan (o'chirilgan) omborlar - "Arxiv" sahifasi uchun. */
export async function listArchivedWarehouses() {
  return db
    .select()
    .from(warehouses)
    .where(isNotNull(warehouses.archivedAt))
    .orderBy(warehouses.name);
}

export async function getWarehouse(id: string) {
  const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id));
  return warehouse;
}

export async function createWarehouse(data: {
  name: string;
  address?: string | null;
  notes?: string | null;
}) {
  const [warehouse] = await db.insert(warehouses).values(data).returning();
  return warehouse;
}

export async function updateWarehouse(
  id: string,
  data: Partial<{ name: string; address: string | null; notes: string | null }>
) {
  const [warehouse] = await db
    .update(warehouses)
    .set(data)
    .where(eq(warehouses.id, id))
    .returning();
  return warehouse;
}

/**
 * Omborni "o'chiradi" - yozuv o'chirilmaydi, arxivga o'tkaziladi (archivedAt).
 * Bu omborga bog'langan tarixiy qoldiq/kirim-chiqim/savdo/xarid yozuvlari
 * buzilib qolmasligi uchun. Arxiv sahifasidan tiklash mumkin.
 */
export async function deleteWarehouse(id: string) {
  await db.update(warehouses).set({ archivedAt: new Date() }).where(eq(warehouses.id, id));
}

export async function restoreWarehouse(id: string) {
  const [warehouse] = await db
    .update(warehouses)
    .set({ archivedAt: null })
    .where(eq(warehouses.id, id))
    .returning();
  return warehouse;
}
