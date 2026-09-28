import type { Currency, ExpenseCategory, Unit } from "./types";

const uzsFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 0,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 3,
});

export function formatMoney(value: number | string, currency: Currency = "UZS") {
  const num = typeof value === "string" ? Number(value) : value;
  if (currency === "USD") return `$${usdFormatter.format(num)}`;
  return `${uzsFormatter.format(num)} so'm`;
}

const compactFormatter = new Intl.NumberFormat("uz-UZ", {
  maximumFractionDigits: 2,
});

/**
 * Qisqa pul ko'rinishi (kartalar uchun): 377 025 000 -> "377 mln so'm",
 * 1 250 000 000 -> "1,25 mlrd so'm", 45 000 -> "45 000 so'm".
 * To'liq qiymatni `title` (hover) da formatMoney bilan ko'rsating.
 */
export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${compactFormatter.format(value / 1_000_000_000)} mlrd so'm`;
  if (abs >= 1_000_000) return `${compactFormatter.format(value / 1_000_000)} mln so'm`;
  return `${uzsFormatter.format(value)} so'm`;
}

export function formatQuantity(value: number | string, unit: Unit) {
  const num = typeof value === "string" ? Number(value) : value;
  return `${numberFormatter.format(num)} ${unit === "ton" ? "t" : "kg"}`;
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(date);
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(date);
}

export function toDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  // Mahalliy (brauzer) sana qismlari ishlatiladi - `toISOString()` har doim
  // UTC'ga o'giradi, shuning uchun Toshkentda kechasi (00:00-04:59) ochilgan
  // forma sana maydonini bir kun oldingi kunga o'rnatib qo'yardi.
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const unitLabels: Record<Unit, string> = {
  kg: "Kilogramm",
  ton: "Tonna",
};

export const partnerTypeLabels: Record<string, string> = {
  customer: "Mijoz",
  supplier: "Yetkazib beruvchi",
  both: "Mijoz va yetkazib beruvchi",
};

export const movementTypeLabels: Record<string, string> = {
  in: "Kirim",
  out: "Chiqim",
};

export const movementSourceLabels: Record<string, string> = {
  purchase: "Xarid",
  manual: "Qo'lda kiritilgan",
  transfer: "Omborlar orasida ko'chirilgan",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "To'liq to'langan",
  partial: "Qisman to'langan",
  credit: "Nasiya",
  cancelled: "Bekor qilingan",
};

export const paymentMethodLabels: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  bank: "Bank o'tkazmasi",
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  supplier_payment: "Yetkazib beruvchiga to'lov",
  salary: "Ish haqi",
  rent: "Ijara",
  transport: "Transport",
  utilities: "Kommunal xizmatlar",
  other: "Boshqa",
};

export const cashDirectionLabels: Record<string, string> = {
  in: "Kirim",
  out: "Chiqim",
};

/**
 * Kassa yozuvi yorlig'i: xarajat (ijara, ish haqi, transport...) qaytmas
 * chiqim; hamkorga naqd chiqim va yetkazib beruvchiga to'lov esa qarz
 * hisobiga ta'sir qilgani uchun oddiy "Chiqim" bo'lib qoladi.
 */
export function cashRowLabel(row: {
  direction: string;
  source: string;
  category: string;
  purpose?: string | null;
}) {
  if (row.source === "expense" && row.category !== "supplier_payment") return "Qaytmas chiqim";
  if (row.purpose === "funding") return row.direction === "in" ? "Pul olib turish" : "Pulni qaytarish";
  return cashDirectionLabels[row.direction] ?? row.direction;
}

export const smsStatusLabels: Record<string, string> = {
  sent: "Yuborildi",
  failed: "Xato",
};

export const smsCreditTypeLabels: Record<string, string> = {
  topup: "To'ldirish",
  usage: "Ishlatildi",
  refund: "Qaytarildi",
};
