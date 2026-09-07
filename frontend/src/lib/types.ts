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
  partnerName: string | null;
  method: string;
  description: string;
  amountUzs: number;
  cancelled: boolean;
  balanceUzs: number;
};

export type CashSummary = {
  currentBalanceUzs: number;
  periodInUzs: number;
  periodOutUzs: number;
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
};

export type DashboardSummary = {
  stockValueUzs: number;
  todaySalesUzs: number;
  todaySalesCount: number;
  monthSalesUzs: number;
  monthSalesCount: number;
  monthProfitUzs: number;
  totalDebtUzs: number;
  lowStockProducts: Product[];
};
