export type Unit = "kg" | "ton";
export type Currency = "UZS" | "USD";
export type PartnerType = "customer" | "supplier" | "both";
export type MovementType = "in" | "out";
export type MovementSource =
  | "manual"
  | "purchase"
  | "purchase_reversal"
  | "sale"
  | "sale_reversal"
  | "transfer";
export type PaymentStatus = "paid" | "partial" | "credit" | "cancelled";
export type PaymentMethod = "cash" | "card" | "bank";
export type ExpenseCategory =
  | "supplier_payment"
  | "salary"
  | "rent"
  | "transport"
  | "utilities"
  | "other";

export type Warehouse = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type ProductStock = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: string;
  avgCostUzs: string;
  updatedAt: string;
  product?: Product;
  warehouse?: Warehouse;
};

// Har xil narxda kirim qilingan (masalan har xil hamkordan olingan) bug'doy
// har biri o'z narxi bilan alohida "partiya" sifatida - Omborlar sahifasi va
// Yangi savdodagi "partiya" tanlovi shu yerdan olinadi.
export type StockLot = {
  id: string;
  productId: string;
  warehouseId: string;
  unitCostUzs: string;
  quantity: string;
  remainingQuantity: string;
  source: MovementSource;
  receivedAt: string;
  productName: string;
  unit: Unit;
  warehouseName: string;
  supplierName: string | null;
};

export type Product = {
  id: string;
  name: string;
  unit: Unit;
  stockQuantity: string;
  minStockAlert: string | null;
  avgCostUzs: string;
  sellingPriceUzs: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Partner = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  bankAccount: string | null;
  type: PartnerType;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  totalSalesUzs: string;
  totalPaidUzs: string;
  totalPurchasesUzs: string;
  totalSupplierPaidUzs: string;
  balanceUzs: number;
};

export type StockMovement = {
  id: string;
  productId: string;
  type: MovementType;
  source: MovementSource;
  quantity: string;
  pricePerUnit: string | null;
  currency: Currency;
  exchangeRateSnapshot: string;
  partnerId: string | null;
  saleId: string | null;
  purchaseId: string | null;
  warehouseId: string | null;
  transferGroupId: string | null;
  vehicleNumber: string | null;
  note: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  // "manual" yozuvlar o'zining cancelledAt'iga, "sale"/"purchase" manbali
  // yozuvlar esa bog'liq savdo/xaridning bekor qilinganiga qarab hisoblanadi.
  cancelled: boolean;
  movementDate: string;
  createdAt: string;
};

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  costPriceUzsSnapshot: string;
  freightCostUzs: string;
  product?: Product;
};

export type PurchaseItem = {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  freightCostUzs: string;
  landedCostUzsSnapshot: string;
  product?: Product;
};

export type Payment = {
  id: string;
  partnerId: string;
  saleId: string | null;
  amount: string;
  currency: Currency;
  exchangeRateSnapshot: string;
  amountUzs: string;
  method: PaymentMethod;
  paymentDate: string;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
};

export type Sale = {
  id: string;
  partnerId: string;
  warehouseId: string | null;
  vehicleNumber: string | null;
  saleDate: string;
  currency: Currency;
  exchangeRateSnapshot: string;
  totalAmount: string;
  totalAmountUzs: string;
  paidAmountUzs: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
  warehouse?: Warehouse;
  items?: SaleItem[];
  payments?: Payment[];
};

export type Purchase = {
  id: string;
  partnerId: string;
  warehouseId: string | null;
  vehicleNumber: string | null;
  purchaseDate: string;
  currency: Currency;
  exchangeRateSnapshot: string;
  totalAmount: string;
  totalAmountUzs: string;
  paidAmountUzs: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
  warehouse?: Warehouse;
  items?: PurchaseItem[];
};

export type PartnerLedgerRow = {
  id: string;
  date: string;
  kind: "delivery" | "payment" | "purchase-delivery" | "supplier-payment";
  saleId: string | null;
  purchaseId: string | null;
  cancelled: boolean;
  productName: string | null;
  vehicleNumber: string | null;
  quantity: number | null;
  unit: Unit | null;
  pricePerUnit: number | null;
  goodsValueUzs: number | null;
  freightCostUzs: number | null;
  paidUzs: number | null;
  paymentMethod: PaymentMethod | null;
  balanceUzs: number;
};

export type Expense = {
  id: string;
  category: ExpenseCategory;
  partnerId: string | null;
  amount: string;
  currency: Currency;
  exchangeRateSnapshot: string;
  amountUzs: string;
  method: PaymentMethod;
  description: string;
  expenseDate: string;
  createdAt: string;
  partner?: Partner | null;
};

export type CashLedgerRow = {
  id: string;
  date: string;
  direction: "in" | "out";
  // qaysi jadvaldan kelgani - "payment" bekor qilinmaydi (savdoga bog'liq)
  source: "payment" | "expense" | "manual";
  // kirim uchun har doim "sale_payment", chiqim uchun expense kategoriyasi
  category: string;
  partnerId: string | null;
  partnerName: string | null;
  method: string;
  bankAccount: string | null;
  description: string;
  amountUzs: number;
  cancelled: boolean;
  // Qo'lda kiritilgan yozuv hamkor qarziga ta'sir qiladimi (boshqa manbalarda doim true)
  affectsPartnerBalance: boolean;
  // Qo'lda kiritilgan yozuvlar uchun: "funding" = "Pul olib turish"
  // (kassani to'ldirish uchun kiritilgan pul), payment/expense qatorlarida null.
  purpose: "regular" | "funding" | null;
  balanceUzs: number;
};

// /cash/ledger `kind` filtri: kirim / chiqim / qaytmas chiqim (xarajat)
export type CashRowKind = "in" | "out" | "non_returnable";

export type CashSummary = {
  currentBalanceUzs: number;
  periodInUzs: number;
  periodOutUzs: number;
  totalExpensesUzs: number;
  // Hali qaytarilmagan "Pul olib turish" summasi - faqat ma'lumot uchun,
  // currentBalanceUzs hisobiga allaqachon kiradi.
  fundingBalanceUzs: number;
};

export type AccountingReport = {
  from: string;
  to: string;
  revenueUzs: number;
  saleCount: number;
  cogsUzs: number;
  freightUzs: number;
  grossProfitUzs: number;
  expensesUzs: number;
  expensesByCategory: { category: string; totalUzs: number }[];
  netProfitUzs: number;
  cashInUzs: number;
  cashOutUzs: number;
  netCashFlowUzs: number;
  receivablesUzs: number;
  // Oldingi teng uzunlikdagi davr (solishtirish uchun)
  previous: {
    from: string;
    to: string;
    revenueUzs: number;
    cogsUzs: number;
    expensesUzs: number;
    netProfitUzs: number;
  };
};

// GET /reports/profit - kunlik (YYYY-MM-DD) yoki oylik (YYYY-MM) nuqtalar
export type ProfitPoint = {
  day: string;
  salesUzs: number;
  cogsUzs: number;
  freightUzs: number;
  expensesUzs: number;
  profitUzs: number;
};

export type DashboardSummary = {
  stockValueUzs: number;
  stockWeightKg: number;
  todaySalesUzs: number;
  todaySalesCount: number;
  monthSalesUzs: number;
  monthSalesCount: number;
  monthProfitUzs: number;
  totalDebtUzs: number;
  lowStockProducts: Product[];
};

// ---------- SMS (TextUP orqali hamkorlarga xabar yuborish) ----------

export type SmsStatus = "sent" | "failed";

// GET /sms/logs qatori - har biri BITTA hamkorga BITTA yuborish urinishi.
export type SmsLog = {
  id: string;
  partnerId: string | null;
  partnerName: string;
  phone: string;
  message: string;
  templateId: string | null;
  status: SmsStatus;
  textupSmsId: string | null;
  errorMessage: string | null;
  sentAt: string;
};

// POST /sms/send javobi
export type SendSmsResultRow = {
  partnerId: string;
  partnerName: string;
  ok: boolean;
  error?: string;
};

export type SendSmsResponse = {
  results: SendSmsResultRow[];
};

// GET /sms/stats
export type SmsStats = {
  sentThisMonth: number;
};

// GET /sms/balance - ichki SMS balansi (oddiy foydalanuvchi ham ko'radi)
export type SmsBalance = {
  balance: number;
};

// ---------- SMS Admin (SMS bo'limi ichidagi, asosiy admindan mustaqil bo'lim) ----------

export type SmsCreditType = "topup" | "usage" | "refund";

export type SmsCreditEntry = {
  id: string;
  type: SmsCreditType;
  amount: number;
  pricePerSmsUzs: string | null;
  totalUzs: string | null;
  note: string | null;
  createdAt: string;
};

// GET /sms-admin/credits
export type SmsCreditsResponse = {
  balance: number;
  priceUzs: number;
  history: SmsCreditEntry[];
};
