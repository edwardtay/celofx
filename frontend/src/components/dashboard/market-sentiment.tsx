"use client";

import { useSignals } from "@/hooks/use-signals";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarketSentiment() {
  const { data: signals, isLoading } = useSignals();

  if (isLoading) return null;

  if (!signals || signals.length === 0) {
    return (
      <div className="border rounded-lg p-3 space-y-2">
        <span className="text-xs text-muted-foreground">Market Sentiment</span>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted" />
        <p className="text-[10px] text-muted-foreground">Scan markets to see sentiment breakdown</p>
      </div>
    );
  }

  const longs = signals.filter((s) => s.direction === "long").length;
  const shorts = signals.filter((s) => s.direction === "short").length;
  const holds = signals.filter((s) => s.direction === "hold").length;
  const total = signals.length;

  const bullPct = Math.round((longs / total) * 100);
  const bearPct = Math.round((shorts / total) * 100);

  const sentiment =
    bullPct > 60 ? "Bullish" : bearPct > 60 ? "Bearish" : "Mixed";
  const sentimentColor =
    sentiment === "Bullish"
      ? "text-emerald-600"
      : sentiment === "Bearish"
        ? "text-red-600"
        : "text-amber-600";
  const SentimentIcon =
    sentiment === "Bullish"
      ? TrendingUp
      : sentiment === "Bearish"
        ? TrendingDown
        : Minus;

  // Per-market sentiment
  const markets = ["mento", "forex", "crypto", "commodities"] as const;
  const marketSentiments = markets.map((m) => {
    const ms = signals.filter((s) => s.market === m);
    const ml = ms.filter((s) => s.direction === "long").length;
    const mTotal = ms.length;
    if (mTotal === 0) return { market: m, pct: 50 };
    return { market: m, pct: Math.round((ml / mTotal) * 100) };
  });

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SentimentIcon className={cn("size-4", sentimentColor)} />
          <span className={cn("text-sm font-semibold", sentimentColor)}>
            {sentiment}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {longs}L / {shorts}S / {holds}H
        </span>
      </div>

      {/* Sentiment bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: `${bullPct}%` }}
        />
        <div
          className="bg-amber-400 transition-all"
          style={{ width: `${100 - bullPct - bearPct}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${bearPct}%` }}
        />
      </div>

      {/* Per-market breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {marketSentiments.map((ms) => (
          <div key={ms.market} className="text-center">
            <div className="h-1 rounded-full bg-muted overflow-hidden mb-1">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  ms.pct > 60
                    ? "bg-emerald-500"
                    : ms.pct < 40
                      ? "bg-red-500"
                      : "bg-amber-400"
                )}
                style={{ width: `${ms.pct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground capitalize">
              {ms.market}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
