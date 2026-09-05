export type Unit = "kg" | "ton";
export type Currency = "UZS" | "USD";
export type PartnerType = "customer" | "supplier" | "both";
export type MovementType = "in" | "out";
export type MovementSource = "manual" | "purchase" | "sale" | "transfer";
export type PaymentStatus = "paid" | "partial" | "credit";
export type PaymentMethod = "cash" | "card" | "bank";

export type Warehouse = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
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
  createdAt: string;
  totalSalesUzs: string;
  totalPaidUzs: string;
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
  warehouseId: string | null;
  transferGroupId: string | null;
  vehicleNumber: string | null;
  note: string | null;
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
  createdAt: string;
  updatedAt: string;
  partner?: Partner;
  warehouse?: Warehouse;
  items?: SaleItem[];
  payments?: Payment[];
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
