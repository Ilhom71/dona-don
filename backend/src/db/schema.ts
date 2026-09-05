import {
  pgTable,
  uuid,
  text,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const unitEnum = pgEnum("unit", ["kg", "ton"]);
export const currencyEnum = pgEnum("currency", ["UZS", "USD"]);
export const partnerTypeEnum = pgEnum("partner_type", [
  "customer", // mijoz - don sotib oladigan
  "supplier", // yetkazib beruvchi - don sotadigan
  "both",
]);
export const movementTypeEnum = pgEnum("movement_type", ["in", "out"]); // kirim / chiqim
export const movementSourceEnum = pgEnum("movement_source", [
  "manual", // qo'lda kiritilgan kirim/chiqim
  "purchase", // hamkordan don sotib olish (kirim)
  "sale", // savdo orqali avtomatik chiqim
  "transfer", // omborlar orasida ko'chirish
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "paid", // to'liq to'langan
  "partial", // qisman to'langan
  "credit", // nasiya (to'lanmagan)
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank",
]);

// ---------- Users (bitta admin foydalanuvchi) ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Exchange rate history (valyuta kursi tarixi) ----------
export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 1 USD = rate UZS
  rate: numeric("rate", { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Products (mahsulotlar) ----------
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  unit: unitEnum("unit").notNull().default("kg"),
  // BARCHA omborlar bo'yicha umumiy qoldiq (product_stock jadvalidan yig'indi,
  // har bir kirim/chiqim/transferda shu yerda ham sinxron yangilanadi - tezkor
  // ko'rish, dashboard va kam-qolish ogohlantirishi uchun).
  stockQuantity: numeric("stock_quantity", { precision: 14, scale: 3 })
    .notNull()
    .default("0"),
  // kam qolganda ogohlantirish uchun chegara (ixtiyoriy)
  minStockAlert: numeric("min_stock_alert", { precision: 14, scale: 3 }),
  // BARCHA omborlar bo'yicha og'irlikli o'rtacha tannarx (UZS). Har bir ombor
  // uchun aniq tannarx product_stock.avgCostUzs'da saqlanadi.
  avgCostUzs: numeric("avg_cost_uzs", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  // standart sotuv narxi (UZS) - yangi savdo yaratganda taklif sifatida ishlatiladi
  sellingPriceUzs: numeric("selling_price_uzs", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- Warehouses (omborlar) ----------
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Product stock (har bir mahsulotning har omborda alohida qoldig'i) ----------
// Bu jadval haqiqiy manba (source of truth); products.stockQuantity/avgCostUzs
// esa shu yerdan hisoblangan tezkor umumiy yig'indi.
export const productStock = pgTable(
  "product_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    avgCostUzs: numeric("avg_cost_uzs", { precision: 14, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("product_stock_product_warehouse_idx").on(t.productId, t.warehouseId)]
);

// ---------- Partners (hamkorlar: mijoz/yetkazib beruvchi) ----------
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  type: partnerTypeEnum("type").notNull().default("customer"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- Sales (savdolar) ----------
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    vehicleNumber: varchar("vehicle_number", { length: 32 }), // mashina raqami
    saleDate: timestamp("sale_date").defaultNow().notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    // savdo vaqtidagi kurs (hisobot uchun UZSga o'girishda ishlatiladi)
    exchangeRateSnapshot: numeric("exchange_rate_snapshot", {
      precision: 14,
      scale: 4,
    }).notNull(),
    totalAmount: numeric("total_amount", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    totalAmountUzs: numeric("total_amount_uzs", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    paidAmountUzs: numeric("paid_amount_uzs", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("credit"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("sales_partner_idx").on(t.partnerId), index("sales_date_idx").on(t.saleDate)]
);

// ---------- Sale items (savdo tarkibidagi mahsulotlar) ----------
export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 16, scale: 2 }).notNull(),
    // sotish paytidagi tannarx (UZS) - daromadni hisoblash uchun saqlanadi
    costPriceUzsSnapshot: numeric("cost_price_uzs_snapshot", {
      precision: 14,
      scale: 2,
    }).notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)]
);

// ---------- Stock movements (ombor kirim-chiqim) ----------
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: movementTypeEnum("type").notNull(),
    source: movementSourceEnum("source").notNull().default("manual"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    pricePerUnit: numeric("price_per_unit", { precision: 14, scale: 2 }),
    currency: currencyEnum("currency").notNull().default("UZS"),
    exchangeRateSnapshot: numeric("exchange_rate_snapshot", {
      precision: 14,
      scale: 4,
    }).notNull(),
    partnerId: uuid("partner_id").references(() => partners.id, {
      onDelete: "set null",
    }),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    // Transfer bo'lsa, chiqim va kirim yozuvi juftligini bog'lash uchun (o'zi FK emas).
    transferGroupId: uuid("transfer_group_id"),
    vehicleNumber: varchar("vehicle_number", { length: 32 }), // mashina raqami (kirim/chiqim yetkazuvi)
    note: text("note"),
    movementDate: timestamp("movement_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId),
    index("stock_movements_date_idx").on(t.movementDate),
  ]
);

// ---------- Payments (to'lovlar - nasiya/qarz to'lash) ----------
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    saleId: uuid("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    exchangeRateSnapshot: numeric("exchange_rate_snapshot", {
      precision: 14,
      scale: 4,
    }).notNull(),
    amountUzs: numeric("amount_uzs", { precision: 16, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    paymentDate: timestamp("payment_date").defaultNow().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("payments_partner_idx").on(t.partnerId), index("payments_sale_idx").on(t.saleId)]
);

// ---------- Relations ----------
export const partnersRelations = relations(partners, ({ many }) => ({
  sales: many(sales),
  payments: many(payments),
  stockMovements: many(stockMovements),
}));

export const productsRelations = relations(products, ({ many }) => ({
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
  stock: many(productStock),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stock: many(productStock),
  stockMovements: many(stockMovements),
  sales: many(sales),
}));

export const productStockRelations = relations(productStock, ({ one }) => ({
  product: one(products, {
    fields: [productStock.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [productStock.warehouseId],
    references: [warehouses.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  partner: one(partners, {
    fields: [sales.partnerId],
    references: [partners.id],
  }),
  warehouse: one(warehouses, {
    fields: [sales.warehouseId],
    references: [warehouses.id],
  }),
  items: many(saleItems),
  payments: many(payments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  partner: one(partners, {
    fields: [stockMovements.partnerId],
    references: [partners.id],
  }),
  sale: one(sales, { fields: [stockMovements.saleId], references: [sales.id] }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  partner: one(partners, {
    fields: [payments.partnerId],
    references: [partners.id],
  }),
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
}));
