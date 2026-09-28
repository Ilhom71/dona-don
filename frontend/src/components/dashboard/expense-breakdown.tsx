import { expenseCategoryLabels, formatMoney, formatMoneyCompact } from "@/lib/format";

/**
 * Xarajatlar tarkibi: kategoriya bo'yicha gorizontal ustunlar va foizlar
 * (kutubxonasiz). Bo'sh bo'lsa - tushunarli matn.
 */
export function ExpenseBreakdown({
  categories,
  totalUzs,
}: {
  categories: { category: string; totalUzs: number }[];
  totalUzs: number;
}) {
  const rows = [...categories].filter((c) => c.totalUzs > 0).sort((a, b) => b.totalUzs - a.totalUzs);
  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">Xarajatlar nimaga ketdi</p>
      {rows.length === 0 || totalUzs <= 0 ? (
        <p className="text-sm text-muted-foreground">Bu davrda xarajat bo&apos;lmagan</p>
      ) : (
        <ul className="space-y-2.5" aria-label="Xarajatlar tarkibi">
          {rows.map((r) => {
            const pct = (r.totalUzs / totalUzs) * 100;
            return (
              <li key={r.category} title={formatMoney(r.totalUzs)}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">
                    {expenseCategoryLabels[r.category as keyof typeof expenseCategoryLabels] ?? r.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoneyCompact(r.totalUzs)} · {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-destructive"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
