"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

function sanitizeRaw(input: string, allowDecimal: boolean) {
  let out = "";
  let seenDot = false;
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch;
    // Nuqta faqal oldida kamida bitta raqam bo'lsa qabul qilinadi - aks
    // holda yolg'iz "." qiymat sifatida qolib ketishi mumkin edi (Number(".")
    // = NaN, JSON'da null bo'lib jo'natilardi).
    else if (allowDecimal && ch === "." && !seenDot && out.length > 0) {
      out += ch;
      seenDot = true;
    }
  }
  return out;
}

function formatDisplay(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

/**
 * Pul/narx kiritish uchun input - foydalanuvchi terayotganda raqamlar 3
 * tadan guruhlab ("3 000 000" kabi) ko'rsatiladi, forma qiymati (`onChange`ga
 * uzatiladigan) esa baribir toza raqam ("3000000") bo'lib qoladi - shuning
 * uchun submit/hisob-kitob qismlariga hech qanday o'zgarish kerak emas.
 */
export function MoneyInput({
  value,
  onChange,
  allowDecimal = false,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string | undefined;
  onChange: (raw: string) => void;
  allowDecimal?: boolean;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={formatDisplay(value ?? "")}
      onChange={(e) => onChange(sanitizeRaw(e.target.value, allowDecimal))}
    />
  );
}
