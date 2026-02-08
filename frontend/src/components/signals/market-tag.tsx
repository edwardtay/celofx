import { Badge } from "@/components/ui/badge";
import type { MarketType } from "@/lib/types";
import { cn } from "@/lib/utils";

const marketStyles: Record<MarketType, string> = {
  crypto: "bg-blue-100 text-blue-700 border-blue-200",
  stocks: "bg-emerald-100 text-emerald-700 border-emerald-200",
  forex: "bg-amber-100 text-amber-700 border-amber-200",
  commodities: "bg-purple-100 text-purple-700 border-purple-200",
};

const marketLabels: Record<MarketType, string> = {
  crypto: "Crypto",
  stocks: "Stocks",
  forex: "Forex",
  commodities: "Commodities",
};

export function MarketTag({ market }: { market: MarketType }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", marketStyles[market])}
    >
      {marketLabels[market]}
    </Badge>
  );
}
