"use client";

import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection } | null;
// Saralash uchun ustun qiymati: son (summa, sana millisekund) yoki matn.
export type SortValue = string | number | null | undefined;
export type SortGetters<T> = Record<string, (item: T) => SortValue>;

// null/undefined har doim oxirida turadi; sonlar son sifatida, matnlar
// o'zbekcha-neytral localeCompare (raqamlarni "natural" tartibda) bilan taqqoslanadi.
function compareValues(a: SortValue, b: SortValue): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Jadval uchun umumiy "ko'rinish" mantiqi: qidiruv (matn bo'yicha filtr) +
 * saralash + sahifalash. `filtered` - qidiruvdan o'tgan va saralangan BARCHA
 * qatorlar (jami/yig'indi qatori shundan hisoblanadi), `pageItems` - faqat
 * joriy sahifadagilari. `sortGetters` - har bir saralanadigan ustun uchun
 * qiymat oluvchi funksiya (kalit = ustun nomi).
 */
export function useTableView<T>(
  items: T[],
  searchText: (item: T) => string,
  initialPageSize = 20,
  sortGetters?: SortGetters<T>
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sort, setSort] = useState<SortState>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? items.filter((item) => searchText(item).toLowerCase().includes(q))
      : items;

    // Saralash yoqilmagan bo'lsa - asl tartib saqlanadi.
    const getter = sort ? sortGetters?.[sort.key] : undefined;
    if (!sort || !getter) return searched;
    const sign = sort.direction === "asc" ? 1 : -1;
    // slice() - asl massivni o'zgartirmaslik uchun; sort barqaror, teng qiymatlar tartibi saqlanadi.
    return searched.slice().sort((x, y) => sign * compareValues(getter(x), getter(y)));
    // searchText/sortGetters har render'da yangi obyekt bo'lishi mumkin - faqat ma'lumot/so'rov/saralash o'zgarganda qayta hisoblaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Ma'lumot kamayib qolsa (masalan qidiruvdan keyin) sahifa chegaradan chiqib ketmasin.
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(1);
    },
    page: safePage,
    setPage,
    totalPages,
    total: filtered.length,
    pageSize,
    // Sahifa hajmi o'zgarganda birinchi sahifaga qaytamiz.
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPage(1);
    },
    sort,
    setSort: (next: SortState) => {
      setSort(next);
      setPage(1);
    },
    // Bosilganda: o'chiq -> o'sish (asc) -> kamayish (desc) -> o'chiq.
    toggleSort: (key: string) => {
      setSort((prev) => {
        if (!prev || prev.key !== key) return { key, direction: "asc" };
        if (prev.direction === "asc") return { key, direction: "desc" };
        return null;
      });
      setPage(1);
    },
    filtered,
    pageItems,
  };
}

export type TableView<T> = ReturnType<typeof useTableView<T>>;
