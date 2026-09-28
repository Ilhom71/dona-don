import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  hint,
  trendPercent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success" | "danger";
  // To'liq qiymat (hover'da ko'rinadi) - `value` qisqartirilgan bo'lganda
  hint?: string;
  // O'tgan davrga nisbatan % o'zgarish (null/undefined - ko'rsatilmaydi)
  trendPercent?: number | null;
}) {
  const hasTrend = trendPercent !== null && trendPercent !== undefined && Number.isFinite(trendPercent);
  const up = hasTrend && (trendPercent as number) >= 0;
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums" title={hint ?? value}>
            {value}
          </p>
          {hasTrend && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              )}
            >
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {up ? "+" : ""}
              {Math.round(trendPercent as number)}% o&apos;tgan davrga nisbatan
            </p>
          )}
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            tone === "warning" && "bg-amber-500/10 text-amber-600",
            tone === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            tone === "danger" && "bg-destructive/10 text-destructive",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
