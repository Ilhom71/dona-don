import Link from "next/link";
import { ArrowRight, HandCoins } from "lucide-react";
import type { Partner } from "@/lib/types";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Kim menga qarz / kimga men qarzman: top-5 ro'yxatlar. */
export function DebtsSection({
  debtors,
  creditors,
  loading,
}: {
  debtors: Partner[];
  creditors: Partner[];
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandCoins className="h-4 w-4 text-primary" />
          Qarzlar
        </CardTitle>
        <CardDescription>Kim menga qarz va men kimga qarzman</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TopList
              title={`Menga qarzdorlar (${debtors.length})`}
              empty="Sizga qarzdor hamkor yo'q"
              rows={debtors.map((p) => ({ id: p.id, name: p.name, value: p.balanceUzs }))}
              tone="good"
            />
            <TopList
              title={`Men qarzdorman (${creditors.length})`}
              empty="Siz hech kimga qarzdor emassiz"
              rows={creditors.map((p) => ({ id: p.id, name: p.name, value: -p.balanceUzs }))}
              tone="bad"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopList({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; value: number }[];
  tone: "good" | "bad";
}) {
  const top = rows.slice(0, 5);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        top.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
            {/* Nomi bosilsa hamkor sahifasiga o'tadi */}
            <Link href={`/savdo/hamkorlar/${r.id}`} className="truncate hover:underline">
              {r.name}
            </Link>
            <span
              className={cn(
                "shrink-0 font-medium tabular-nums",
                tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
              )}
              title={formatMoney(r.value)}
            >
              {formatMoneyCompact(r.value)}
            </span>
          </div>
        ))
      )}
      {rows.length > 0 && (
        <Link
          href="/savdo/hamkorlar"
          className="flex items-center gap-1 pt-1 text-xs text-primary hover:underline"
        >
          Barchasi{rows.length > top.length ? ` (yana ${rows.length - top.length} ta)` : ""}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
