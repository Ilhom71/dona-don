import type { Currency, Unit } from "./types";

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
  return date.toISOString().slice(0, 10);
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

export const paymentStatusLabels: Record<string, string> = {
  paid: "To'liq to'langan",
  partial: "Qisman to'langan",
  credit: "Nasiya",
};

export const paymentMethodLabels: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  bank: "Bank o'tkazmasi",
};
