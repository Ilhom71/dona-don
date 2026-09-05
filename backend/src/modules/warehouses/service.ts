import { eq } from "drizzle-orm";
import { db } from "../../db";
import { warehouses } from "../../db/schema";

export async function listWarehouses() {
  return db.select().from(warehouses).orderBy(warehouses.name);
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

export async function deleteWarehouse(id: string) {
  await db.delete(warehouses).where(eq(warehouses.id, id));
}
