"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SortState } from "@/hooks/use-table-view";

// Sahifa hajmi tanlovi
const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** Jadval tepasidagi qidiruv maydoni. */
export function TableSearch({
  value,
  onChange,
  placeholder = "Qidirish...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

/**
 * Uzun matn (tavsif): standart holatda 1 qatorda kesiladi, bosilganda to'liq
 * ochiladi (yana bosilsa yig'iladi). Jadval katagi/kartada ishlatiladi.
 */
export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      title={open ? "Yig'ish" : "To'liq ko'rish"}
      className={cn(
        "block w-full cursor-pointer text-left",
        open ? "whitespace-normal break-words" : "truncate",
        className
      )}
    >
      {text}
    </button>
  );
}

/**
 * Saralanadigan ustun sarlavhasi: bosilganda o'sish -> kamayish -> o'chiq.
 * `view` - useTableView qaytargan obyekt (faqat sort va toggleSort kerak).
 * `align="right"` - summa ustunlari uchun.
 */
export function SortableHead({
  label,
  sortKey,
  view,
  align = "left",
  className,
}: {
  label: string;
  sortKey: string;
  view: { sort: SortState; toggleSort: (key: string) => void };
  align?: "left" | "right";
  className?: string;
}) {
  const active = view.sort?.key === sortKey ? view.sort.direction : null;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
    >
      <button
        type="button"
        onClick={() => view.toggleSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : ""
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

/**
 * Filtrlangan jadvalni Excel'da ochiladigan faylga yuklab olish. Qatorlar
 * brauzerda (allaqachon filtrlangan/saralangan holatda) yig'iladi, shuning
 * uchun ekrandagi natija bilan aynan bir xil. Format: UTF-8 BOM + ";"
 * ajratuvchi ("sep=;" qatori Excel'ga ajratuvchini aniq aytadi).
 */
export function TableExportButton({
  fileName,
  headers,
  rows,
  disabled,
}: {
  fileName: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  disabled?: boolean;
}) {
  function download() {
    // Har bir katak qo'shtirnoqqa o'raladi, ichidagi qo'shtirnoq ikkilanadi.
    const esc = (v: string | number | null | undefined) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers, ...rows].map((r) => r.map(esc).join(";"));
    const csv = "﻿" + "sep=;\r\n" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || rows.length === 0}
      onClick={download}
      title="Ekrandagi (filtrlangan) jadvalni Excel'da ochiladigan faylga yuklab olish"
    >
      <Download className="h-4 w-4" />
      Filtrlangan jadvalni yuklash
    </Button>
  );
}

/** Jadval ostidagi sahifalash: "1-20 / 134", sahifa hajmi va oldingi/keyingi tugmalar. */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  // Berilsa - "Sahifada: 20/50/100" tanlovi ko'rinadi.
  onPageSizeChange?: (size: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // Joriy hajm (masalan 12) standart ro'yxatda bo'lmasa ham tanlovda ko'rinadi.
  const sizes = Array.from(new Set([...PAGE_SIZE_OPTIONS, pageSize])).sort((a, b) => a - b);
  const sizeItems = sizes.map((n) => ({ value: String(n), label: String(n) }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          {from}-{to} / {total} ta
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Sahifada:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => v && onPageSizeChange(Number(v))}
              items={sizeItems}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Oldingi
        </Button>
        <span>
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Keyingi
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Mobil (karta ko'rinishidagi) jadvallar uchun saralash: ustun sarlavhalari
 * ko'rinmagani uchun, xuddi shu saralashni tanlov + yo'nalish tugmasi orqali
 * beradi. Faqat mobilda ko'rinadi (md:hidden).
 */
export function MobileSortSelect({
  view,
  options,
}: {
  view: {
    sort: SortState;
    setSort: (next: SortState) => void;
  };
  options: { key: string; label: string }[];
}) {
  const items = [{ value: "none", label: "Saralanmagan" }, ...options.map((o) => ({ value: o.key, label: o.label }))];
  const current = view.sort?.key ?? "none";
  const direction = view.sort?.direction ?? "asc";
  return (
    <div className="flex items-center gap-2 md:hidden">
      <span className="text-sm text-muted-foreground">Saralash:</span>
      <Select
        value={current}
        onValueChange={(v) => {
          if (!v || v === "none") view.setSort(null);
          else view.setSort({ key: v, direction });
        }}
        items={items}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={!view.sort}
        title={direction === "asc" ? "O'sish tartibida" : "Kamayish tartibida"}
        onClick={() =>
          view.sort &&
          view.setSort({ key: view.sort.key, direction: direction === "asc" ? "desc" : "asc" })
        }
      >
        {direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </Button>
    </div>
  );
}
