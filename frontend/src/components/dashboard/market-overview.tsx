"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCompact, formatPercent } from "@/lib/format";
import {
  useCryptoData,
  useForexData,
  useCommodityData,
} from "@/hooks/use-market-data";
import type { AssetPrice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bitcoin, DollarSign, Gem } from "lucide-react";

const marketConfig = [
  { key: "forex", label: "Forex", icon: DollarSign, hook: useForexData },
  { key: "crypto", label: "Crypto", icon: Bitcoin, hook: useCryptoData },
  { key: "commodities", label: "Commodities", icon: Gem, hook: useCommodityData },
] as const;

function MarketCard({
  label,
  icon: Icon,
  data,
  isLoading,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  data?: AssetPrice[];
  isLoading: boolean;
}) {
  const topAsset = data?.[0];

  return (
    <Card className="gap-0 py-0 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {isLoading || !topAsset ? (
          <div className="space-y-2">
            <div className="h-6 bg-muted rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold font-mono">
                {formatCurrencyCompact(topAsset.price)}
              </span>
              <span
                className={cn(
                  "text-xs font-mono font-medium",
                  topAsset.change24h >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {formatPercent(topAsset.change24h)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {topAsset.symbol} · {topAsset.name}
            </p>
            {data && data.length > 1 && (
              <div className="flex gap-3 mt-2">
                {data.slice(1, 4).map((asset) => (
                  <div key={asset.symbol} className="text-xs">
                    <span className="text-muted-foreground">
                      {asset.symbol}
                    </span>{" "}
                    <span
                      className={cn(
                        "font-mono",
                        asset.change24h >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      )}
                    >
                      {formatPercent(asset.change24h)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketOverview() {
  const forex = useForexData();
  const crypto = useCryptoData();
  const commodities = useCommodityData();

  const results = [forex, crypto, commodities];
  const allLoaded = results.every((r) => !r.isLoading && r.data);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Markets</h2>
        {allLoaded && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · refreshes every 60s
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {marketConfig.map((market, i) => (
          <MarketCard
            key={market.key}
            label={market.label}
            icon={market.icon}
            data={results[i].data}
            isLoading={results[i].isLoading}
          />
        ))}
      </div>
    </div>
  );
}
