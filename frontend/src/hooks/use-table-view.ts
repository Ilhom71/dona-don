"use client";

import { useMemo, useState } from "react";

/**
 * Jadval uchun umumiy "ko'rinish" mantiqi: qidiruv (matn bo'yicha filtr) +
 * sahifalash. `filtered` - qidiruvdan o'tgan BARCHA qatorlar (jami/yig'indi
 * qatori shundan hisoblanadi), `pageItems` - faqat joriy sahifadagilari.
 */
export function useTableView<T>(
  items: T[],
  searchText: (item: T) => string,
  pageSize = 20
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => searchText(item).toLowerCase().includes(q));
    // searchText har render'da yangi funksiya bo'lishi mumkin - faqat ma'lumot/so'rov o'zgarganda qayta hisoblaymiz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);

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
    filtered,
    pageItems,
  };
}

export type TableView<T> = ReturnType<typeof useTableView<T>>;
