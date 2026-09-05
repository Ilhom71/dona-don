import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { partners, sales, payments } from "../../db/schema";

/**
 * Hamkorlar ro'yxati + har biri uchun qarzdorlik balansi (UZS).
 * balance = (barcha savdolar summasi) - (barcha to'lovlar summasi)
 * Musbat balance = hamkor qarzdor (u bizga to'lashi kerak).
 *
 * Eslatma: ikkita bir-ko'p bog'lanishni (sales, payments) bitta JOIN'da
 * yig'indilash qatorlarni ko'paytirib yuboradi (fan-out), shuning uchun
 * har biri alohida guruhlangan derived table sifatida LEFT JOIN qilinadi.
 */
export async function listPartnersWithBalance() {
  const salesTotals = db
    .select({
      partnerId: sales.partnerId,
      total: sql<string>`sum(${sales.totalAmountUzs})`.as("total_sales_uzs"),
    })
    .from(sales)
    .groupBy(sales.partnerId)
    .as("sales_totals");

  const paymentTotals = db
    .select({
      partnerId: payments.partnerId,
      total: sql<string>`sum(${payments.amountUzs})`.as("total_paid_uzs"),
    })
    .from(payments)
    .groupBy(payments.partnerId)
    .as("payment_totals");

  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      phone: partners.phone,
      address: partners.address,
      type: partners.type,
      notes: partners.notes,
      createdAt: partners.createdAt,
      totalSalesUzs: sql<string>`coalesce(${salesTotals.total}, 0)`,
      totalPaidUzs: sql<string>`coalesce(${paymentTotals.total}, 0)`,
    })
    .from(partners)
    .leftJoin(salesTotals, eq(salesTotals.partnerId, partners.id))
    .leftJoin(paymentTotals, eq(paymentTotals.partnerId, partners.id))
    .orderBy(partners.name);

  return rows.map((r) => ({
    ...r,
    balanceUzs: Number(r.totalSalesUzs) - Number(r.totalPaidUzs),
  }));
}

export async function getPartner(id: string) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, id));
  return partner;
}

export async function createPartner(data: {
  name: string;
  phone?: string | null;
  address?: string | null;
  type: "customer" | "supplier" | "both";
  notes?: string | null;
}) {
  const [partner] = await db.insert(partners).values(data).returning();
  return partner;
}

export async function updatePartner(
  id: string,
  data: Partial<{
    name: string;
    phone: string | null;
    address: string | null;
    type: "customer" | "supplier" | "both";
    notes: string | null;
  }>
) {
  const [partner] = await db
    .update(partners)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(partners.id, id))
    .returning();
  return partner;
}

export async function deletePartner(id: string) {
  await db.delete(partners).where(eq(partners.id, id));
}
