import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BarRow = {
  label: string;
  value: number;
  // Rang vazifasi: "neutral" - oddiy ko'rsatkich, "good" - foyda/haq, "bad" - zarar/qarz.
  tone: "neutral" | "good" | "bad";
  hint?: string;
};

const toneClass: Record<BarRow["tone"], string> = {
  neutral: "bg-primary",
  good: "bg-emerald-500",
  bad: "bg-destructive",
};

const toneText: Record<BarRow["tone"], string> = {
  neutral: "text-foreground",
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-destructive",
};

/**
 * Oddiy gorizontal ustunli diagramma (kutubxonasiz, HTML/CSS) - har bir
 * qator: nom, ustun (eng katta qiymatga nisbatan), qiymat (to'g'ridan-to'g'ri
 * yozilgan). Rang ma'no bilan bog'liq (yashil = foyda/haq, qizil = zarar/qarz),
 * lekin qiymat doim matn sifatida ham yoziladi (rang yagona belgi emas).
 */
export function HorizontalBars({ rows, ariaLabel }: { rows: BarRow[]; ariaLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {rows.map((r) => {
        const width = Math.max(r.value === 0 ? 0 : 2, (Math.abs(r.value) / max) * 100);
        return (
          <li key={r.label} title={r.hint ?? `${r.label}: ${formatMoney(r.value)}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={cn("font-semibold tabular-nums", toneText[r.tone])}>
                {formatMoney(r.value)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-sm bg-muted">
              <div
                className={cn("h-full rounded-sm transition-all", toneClass[r.tone])}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
