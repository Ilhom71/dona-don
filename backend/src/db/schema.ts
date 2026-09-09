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
  "purchase_reversal", // bekor qilingan xarid uchun mahsulotni ombordan ayirish (chiqim)
  "sale", // savdo orqali avtomatik chiqim
  "sale_reversal", // bekor qilingan savdo uchun mahsulotni omborga qaytarish (kirim)
  "transfer", // omborlar orasida ko'chirish
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "paid", // to'liq to'langan
  "partial", // qisman to'langan
  "credit", // nasiya (to'lanmagan)
  "cancelled", // savdo bekor qilingan (storno)
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank",
]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "supplier_payment", // yetkazib beruvchiga to'lov (qarz kamayadi)
  "salary", // ish haqi
  "rent", // ijara
  "transport", // transport/yoqilg'i
  "utilities", // kommunal xizmatlar
  "other", // boshqa
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
  // "O'chirish" bosilganda yozuv o'chirilmaydi, shu maydon to'ldiriladi (arxiv)
  // - tarixiy yozuvlar (savdo/xarid/kirim-chiqim)dagi bog'lanish buzilmasin
  // uchun. Arxiv sahifasidan "Tiklash" bilan yana faollashtiriladi.
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- Warehouses (omborlar) ----------
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  address: text("address"),
  notes: text("notes"),
  archivedAt: timestamp("archived_at"),
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
  // Hamkorga pul o'tkazish uchun bank hisob raqami (ixtiyoriy).
  bankAccount: varchar("bank_account", { length: 64 }),
  type: partnerTypeEnum("type").notNull().default("customer"),
  notes: text("notes"),
  archivedAt: timestamp("archived_at"),
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
    // Savdo bekor qilinsa (storno), yozuv o'chirilmaydi/tahrirlanmaydi - faqat
    // shu ikki maydon to'ldiriladi va omborga teskari (kirim) yozuv qo'shiladi.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
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
    // yuk puli (tashish xarajati) - har bir mahsulot qatori uchun alohida,
    // doim UZS'da saqlanadi va hamkorning umumiy qarziga (totalAmountUzs) qo'shiladi
    freightCostUzs: numeric("freight_cost_uzs", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)]
);

// ---------- Purchases (xaridlar - yetkazib beruvchidan omborga kirim) ----------
// sales/sale_items'ga parallel struktura: hamkor (yetkazib beruvchi) tanlanadi,
// bir nechta mahsulot qatori kiritiladi, jami summa avtomatik hisoblanadi.
export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "restrict",
    }),
    vehicleNumber: varchar("vehicle_number", { length: 32 }), // mashina raqami
    purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    // xarid vaqtidagi kurs (hisobot uchun UZSga o'girishda ishlatiladi)
    exchangeRateSnapshot: numeric("exchange_rate_snapshot", {
      precision: 14,
      scale: 4,
    }).notNull(),
    totalAmount: numeric("total_amount", { precision: 16, scale: 2 })
      .notNull()
      .default("0"),
    // mahsulotlar summasi (UZS) + yuk puli yig'indisi
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
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("purchases_partner_idx").on(t.partnerId),
    index("purchases_date_idx").on(t.purchaseDate),
  ]
);

// ---------- Purchase items (xarid tarkibidagi mahsulotlar) ----------
export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 16, scale: 2 }).notNull(),
    // yuk puli (tashish xarajati) - har bir mahsulot qatori uchun alohida, doim UZS
    freightCostUzs: numeric("freight_cost_uzs", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    // (subtotal_uzs + freightCostUzs) / quantity - omborga kirim qilingan
    // haqiqiy birlik tannarxi (landed cost), avgCostUzs shu qiymat bilan yangilanadi
    landedCostUzsSnapshot: numeric("landed_cost_uzs_snapshot", {
      precision: 14,
      scale: 2,
    }).notNull(),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)]
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
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    // Transfer bo'lsa, chiqim va kirim yozuvi juftligini bog'lash uchun (o'zi FK emas).
    transferGroupId: uuid("transfer_group_id"),
    vehicleNumber: varchar("vehicle_number", { length: 32 }), // mashina raqami (kirim/chiqim yetkazuvi)
    note: text("note"),
    // Faqat "manual" (qo'lda kiritilgan) yozuvlar uchun bekor qilish - yozuv
    // o'chirilmaydi, faqat qoldiq teskari qaytariladi. "sale"/"purchase" kabi
    // avtomatik yozuvlar o'z manba yozuvi (savdo/xarid) orqali bekor qilinadi.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    movementDate: timestamp("movement_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId),
    index("stock_movements_date_idx").on(t.movementDate),
  ]
);

// ---------- Stock lots (FIFO tannarx uchun partiyalar) ----------
// Har bir kirim (xarid/qo'lda/transfer) alohida partiya sifatida saqlanadi,
// o'z narxi (unitCostUzs) bilan - bu narx hech qachon o'zgarmaydi. Sotilganda/
// chiqimda eng eski (receivedAt) faol partiyadan navbat bilan yechiladi
// (stock_lot_consumptions orqali), shunda yangi narxda kirim qilingan
// mahsulot eski partiyaning tannarxiga ta'sir qilmaydi.
export const stockLots = pgTable(
  "stock_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    unitCostUzs: numeric("unit_cost_uzs", { precision: 14, scale: 2 }).notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    remainingQuantity: numeric("remaining_quantity", { precision: 14, scale: 3 }).notNull(),
    source: movementSourceEnum("source").notNull(),
    purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
    movementId: uuid("movement_id").references(() => stockMovements.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at").notNull(),
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("stock_lots_product_warehouse_idx").on(t.productId, t.warehouseId, t.receivedAt),
  ]
);

// ---------- Stock lot consumptions (qaysi partiyadan qancha yechilgani) ----------
// Har bir savdo qatori yoki qo'lda chiqim/transfer qaysi partiya(lar)dan qancha
// miqdorni FIFO tartibida "yegani"ni qayd etadi - bekor qilish/tiklashda aynan
// o'sha partiya(lar)ga qaytarish/qayta yechish uchun kerak.
export const stockLotConsumptions = pgTable(
  "stock_lot_consumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => stockLots.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitCostUzs: numeric("unit_cost_uzs", { precision: 14, scale: 2 }).notNull(),
    saleItemId: uuid("sale_item_id").references(() => saleItems.id, { onDelete: "set null" }),
    movementId: uuid("movement_id").references(() => stockMovements.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("stock_lot_consumptions_lot_idx").on(t.lotId)]
);

// ---------- Day openings (kun ochish) ----------
// Foydalanuvchi kun boshida tugma bosadi - shundan keyingina savdo qilish
// mumkin (createSale shu jadvaldan tekshiradi). Bir sanaga bir qator - qayta
// bosilsa (masalan yopilgandan keyin qayta ochilsa) `openedAt` yangilanadi
// (upsert) - shu orqali "ochiqmi" holati dayClosings bilan solishtirib
// aniqlanadi (pastga, day-closings/service.ts'ga qara).
export const dayOpenings = pgTable("day_openings", {
  id: uuid("id").primaryKey().defaultRandom(),
  openingDate: varchar("opening_date", { length: 10 }).notNull().unique(), // "YYYY-MM-DD"
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  note: text("note"),
});

// ---------- Day closings (kun yopish) ----------
// Foydalanuvchi kun oxirida tugma bosadi: 1) shu paytdagi kassa qoldig'i
// buxgalteriyaga o'tkaziladi (haqiqiy pul harakati - xuddi qo'lda "Kassadan
// o'tkazish" kabi), 2) shu kungi kassa qoldig'i/savdo/kirim-chiqim "suratga
// olinadi" va saqlanadi, 3) kun "yopiq" holatga o'tadi - yangi savdo yaratib
// bo'lmaydi, kun qayta ochilmaguncha (dayOpenings, yuqoriga qara). Bir kunga
// bir qator - qayta bosilsa yangilanadi (upsert).
export const dayClosings = pgTable("day_closings", {
  id: uuid("id").primaryKey().defaultRandom(),
  closingDate: varchar("closing_date", { length: 10 }).notNull().unique(), // "YYYY-MM-DD"
  kassaBalanceUzs: numeric("kassa_balance_uzs", { precision: 16, scale: 2 }).notNull(),
  warehouseStockValueUzs: numeric("warehouse_stock_value_uzs", { precision: 16, scale: 2 }).notNull(),
  todaySalesUzs: numeric("today_sales_uzs", { precision: 16, scale: 2 }).notNull(),
  periodInUzs: numeric("period_in_uzs", { precision: 16, scale: 2 }).notNull(),
  periodOutUzs: numeric("period_out_uzs", { precision: 16, scale: 2 }).notNull(),
  note: text("note"),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
});

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
    // To'lov bekor qilinsa, yozuv o'chirilmaydi - shu ikki maydon to'ldiriladi
    // (immutable ledger), bog'liq savdoning paidAmountUzs/holati qayta
    // hisoblanadi. Arxiv sahifasidan "Tiklash" bilan qaytariladi.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("payments_partner_idx").on(t.partnerId), index("payments_sale_idx").on(t.saleId)]
);

// ---------- Expenses (kassadan chiqim: xarajatlar, yetkazib beruvchiga to'lov) ----------
// `payments` faqat mijozdan kelgan pulni (kirim) qayd etadi; kassaning to'liq
// balansini ko'rish uchun chiqim tomoni shu jadvalda alohida saqlanadi.
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: expenseCategoryEnum("category").notNull().default("other"),
    // "supplier_payment" kategoriyasida qaysi hamkorga to'langani (ixtiyoriy, boshqalarida bo'sh)
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    exchangeRateSnapshot: numeric("exchange_rate_snapshot", {
      precision: 14,
      scale: 4,
    }).notNull(),
    amountUzs: numeric("amount_uzs", { precision: 16, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    description: text("description").notNull(),
    expenseDate: timestamp("expense_date").defaultNow().notNull(),
    // Xarajat bekor qilinsa, yozuv o'chirilmaydi - shu ikki maydon to'ldiriladi
    // (immutable ledger). Arxiv sahifasidan "Tiklash" bilan qaytariladi.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("expenses_date_idx").on(t.expenseDate),
    index("expenses_category_idx").on(t.category),
  ]
);

// Qaysi "hisob"ga tegishli: "kassa" - kunlik naqd savdo kassasi,
// "buxgalteriya" - firmaning joriy hisobi (rasmiy, kassadan o'tkazma orqali
// to'ldiriladi). Ikkalasi bir xil jadvalda, faqat shu ustun bilan ajratiladi.
export const cashAccountEnum = pgEnum("cash_account", ["kassa", "buxgalteriya"]);

// ---------- Cash transactions (kassaga qo'lda kiritilgan kirim/chiqim) ----------
// Savdo to'lovi (`payments`) yoki xarajat (`expenses`) bilan bog'liq bo'lmagan,
// kassadan qo'lda pul kiritish/chiqarish uchun (masalan egasi naqd pul qo'shdi
// yoki kassadan shaxsiy ehtiyoj uchun naqd oldi) - har doim izoh bilan.
export const cashTransactions = pgTable(
  "cash_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    direction: movementTypeEnum("direction").notNull(), // "in" yoki "out" (mavjud enum qayta ishlatiladi)
    // Qaysi hisob (kassa/buxgalteriya) - standart "kassa" (eski yozuvlar ham
    // shu hisobga tegishli deb hisoblanadi).
    account: cashAccountEnum("account").notNull().default("kassa"),
    // Qaysi hamkor bilan bog'liqligi (ixtiyoriy) - masalan hamkordan naqd
    // qarz olindi/berildi kabi holatlar uchun.
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    amountUzs: numeric("amount_uzs", { precision: 16, scale: 2 }).notNull(),
    // Qanday usulda: naqd / karta / bank o'tkazmasi - ayniqsa hamkorga pul
    // o'tkazilganda ("Pul o'tkazish") aniq ko'rinishi uchun.
    method: paymentMethodEnum("method").notNull().default("cash"),
    // method="bank" bo'lganda - aynan qaysi bank hisob raqamiga/dan
    // o'tkazilgani (odatda hamkorning saqlangan raqami, lekin qo'lda ham
    // kiritish mumkin - masalan boshqa hisobga to'langan bo'lsa).
    bankAccount: varchar("bank_account", { length: 64 }),
    note: text("note").notNull(),
    // Yozuv bekor qilinsa, o'chirilmaydi - shu ikki maydon to'ldiriladi
    // (immutable ledger). Arxiv sahifasidan "Tiklash" bilan qaytariladi.
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),
    // Kassadan buxgalteriyaga o'tkazmada bitta amalda 2 ta bog'liq yozuv
    // yaratiladi (kassadan chiqim + buxgalteriyaga kirim) - shu ustun ular
    // orasidagi bog'lanish, `stock_movements.transfer_group_id`ga parallel.
    // Bittasi bekor qilinganda ikkinchisi ham avtomatik bekor qilinadi
    // (aks holda ikki hisob orasida qoldiq mos kelmay qoladi).
    transferGroupId: uuid("transfer_group_id"),
    transactionDate: timestamp("transaction_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("cash_transactions_date_idx").on(t.transactionDate)]
);

// ---------- Relations ----------
export const partnersRelations = relations(partners, ({ many }) => ({
  sales: many(sales),
  purchases: many(purchases),
  payments: many(payments),
  stockMovements: many(stockMovements),
  expenses: many(expenses),
  cashTransactions: many(cashTransactions),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  partner: one(partners, {
    fields: [cashTransactions.partnerId],
    references: [partners.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  saleItems: many(saleItems),
  purchaseItems: many(purchaseItems),
  stockMovements: many(stockMovements),
  stock: many(productStock),
  lots: many(stockLots),
}));

export const stockLotsRelations = relations(stockLots, ({ one, many }) => ({
  product: one(products, { fields: [stockLots.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [stockLots.warehouseId], references: [warehouses.id] }),
  purchase: one(purchases, { fields: [stockLots.purchaseId], references: [purchases.id] }),
  movement: one(stockMovements, { fields: [stockLots.movementId], references: [stockMovements.id] }),
  consumptions: many(stockLotConsumptions),
}));

export const stockLotConsumptionsRelations = relations(stockLotConsumptions, ({ one }) => ({
  lot: one(stockLots, { fields: [stockLotConsumptions.lotId], references: [stockLots.id] }),
  saleItem: one(saleItems, { fields: [stockLotConsumptions.saleItemId], references: [saleItems.id] }),
  movement: one(stockMovements, { fields: [stockLotConsumptions.movementId], references: [stockMovements.id] }),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stock: many(productStock),
  stockMovements: many(stockMovements),
  sales: many(sales),
  purchases: many(purchases),
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

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  lotConsumptions: many(stockLotConsumptions),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  partner: one(partners, {
    fields: [purchases.partnerId],
    references: [partners.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchases.warehouseId],
    references: [warehouses.id],
  }),
  items: many(purchaseItems),
  lots: many(stockLots),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one, many }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  partner: one(partners, {
    fields: [stockMovements.partnerId],
    references: [partners.id],
  }),
  sale: one(sales, { fields: [stockMovements.saleId], references: [sales.id] }),
  purchase: one(purchases, {
    fields: [stockMovements.purchaseId],
    references: [purchases.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  lots: many(stockLots),
  lotConsumptions: many(stockLotConsumptions),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  partner: one(partners, {
    fields: [payments.partnerId],
    references: [partners.id],
  }),
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  partner: one(partners, {
    fields: [expenses.partnerId],
    references: [partners.id],
  }),
}));
