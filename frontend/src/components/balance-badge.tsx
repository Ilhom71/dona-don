import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

/**
 * Hamkor balansini ko'rsatadi:
 *  - hamkor bizga qarzdor (qarz bor) - **qizil**, "-" belgi bilan
 *  - hamkorning puli bizda (biz unga qarzdormiz / ortiqcha to'lagan) -
 *    **yashil**, "+" belgi bilan (yaxshi holat sifatida ko'rsatiladi)
 *  - hisob-kitob teng - kulrang
 * Barcha hamkor balansi ko'rsatiladigan joylarda shu bitta komponent
 * ishlatiladi (Hamkorlar, hamkor sahifasi, Kassa → Hamkorlar) - alohida-
 * alohida yozilsa, birida tuzatilib boshqasida unutilib qolish xavfi bor.
 */
export function BalanceBadge({ value }: { value: number }) {
  if (value === 0) return <Badge variant="secondary">{formatMoney(0)}</Badge>;
  if (value > 0) {
    return (
      <Badge variant="destructive" className="gap-0.5">
        <Minus className="h-3 w-3" />
        {formatMoney(value)}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-0.5 border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
    >
      <Plus className="h-3 w-3" />
      {formatMoney(-value)}
    </Badge>
  );
}
