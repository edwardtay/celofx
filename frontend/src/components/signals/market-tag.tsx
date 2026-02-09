import { Badge } from "@/components/ui/badge";
import type { MarketType } from "@/lib/types";
import { cn } from "@/lib/utils";

const marketStyles: Record<MarketType, string> = {
  mento: "bg-green-100 text-green-700 border-green-200",
  crypto: "bg-blue-100 text-blue-700 border-blue-200",
  forex: "bg-amber-100 text-amber-700 border-amber-200",
  commodities: "bg-purple-100 text-purple-700 border-purple-200",
};

const marketLabels: Record<MarketType, string> = {
  mento: "Mento FX",
  crypto: "Crypto",
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
