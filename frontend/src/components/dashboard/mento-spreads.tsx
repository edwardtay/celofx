"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMentoData, useCrossVenueData, type CrossVenueRate } from "@/hooks/use-market-data";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, TrendingDown, Minus, ExternalLink, Layers } from "lucide-react";
import type { MentoRate } from "@/lib/market-data";

// ─── Cross-Venue Card (Mento vs Uniswap vs Forex) ───
function CrossVenueCard({ rate }: { rate: CrossVenueRate }) {
  const [from, to] = rate.pair.split("/");
  const bestSpread = Math.max(
    rate.mentoVsForex ?? -Infinity,
    rate.uniswapVsForex ?? -Infinity
  );
  const isPositive = bestSpread > 0.3;
  const isNegative = bestSpread < -0.3;
  const hasVenueArb = rate.venueSpread !== null && Math.abs(rate.venueSpread) > 0.1;

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 hover:shadow-md",
        hasVenueArb && "border-blue-200 bg-blue-50/30",
        !hasVenueArb && isPositive && "border-emerald-200 bg-emerald-50/30",
        !hasVenueArb && isNegative && "border-red-200 bg-red-50/30"
      )}
    >
      <CardContent className="py-4 space-y-3">
        {/* Pair header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold font-mono">{from}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold font-mono">{to}</span>
          </div>
          {hasVenueArb ? (
            <div className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <Layers className="size-3" />
              Cross-venue arb
            </div>
          ) : (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                isPositive && "bg-emerald-100 text-emerald-700",
                isNegative && "bg-red-100 text-red-700",
                !isPositive && !isNegative && "bg-amber-50 text-amber-700"
              )}
            >
              {isPositive ? <TrendingUp className="size-3" /> : isNegative ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
              {rate.bestVenue === "mento" ? "Mento best" : rate.bestVenue === "uniswap" ? "Uni best" : "Monitor"}
            </div>
          )}
        </div>

        {/* Rate comparison: Mento vs Uniswap vs Forex */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mento</p>
            <p className="text-base font-mono font-semibold">
              {rate.mentoRate?.toFixed(4) ?? "—"}
            </p>
            {rate.mentoVsForex !== null && (
              <p className={cn(
                "text-[10px] font-mono",
                rate.mentoVsForex > 0.3 ? "text-emerald-600" : rate.mentoVsForex < -0.3 ? "text-red-500" : "text-muted-foreground"
              )}>
                {rate.mentoVsForex > 0 ? "+" : ""}{rate.mentoVsForex.toFixed(2)}%
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Uniswap</p>
            <p className="text-base font-mono font-semibold">
              {rate.uniswapRate?.toFixed(4) ?? "—"}
            </p>
            {rate.uniswapVsForex !== null && (
              <p className={cn(
                "text-[10px] font-mono",
                rate.uniswapVsForex > 0.3 ? "text-emerald-600" : rate.uniswapVsForex < -0.3 ? "text-red-500" : "text-muted-foreground"
              )}>
                {rate.uniswapVsForex > 0 ? "+" : ""}{rate.uniswapVsForex.toFixed(2)}%
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Forex</p>
            <p className="text-base font-mono font-semibold text-muted-foreground">
              {rate.forexRate.toFixed(4)}
            </p>
            {rate.venueSpread !== null && (
              <p className={cn(
                "text-[10px] font-mono",
                Math.abs(rate.venueSpread) > 0.1 ? "text-blue-600" : "text-muted-foreground"
              )}>
                Gap: {rate.venueSpread > 0 ? "+" : ""}{rate.venueSpread.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        {/* Arb hint */}
        {hasVenueArb && (
          <p className="text-xs text-blue-700">
            {Math.abs(rate.venueSpread!).toFixed(2)}% spread between Mento and Uniswap — cross-venue arbitrage opportunity
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Single-venue Mento card (for pairs without Uniswap pool) ───
function SpreadCard({ rate }: { rate: MentoRate }) {
  const isPositive = rate.spreadPct > 0.3;
  const isStrongNegative = rate.spreadPct < -0.3;
  const isNeutral = !isPositive && !isStrongNegative;
  const [from, to] = rate.pair.split("/");
  const label = isPositive ? "Swap Now" : isStrongNegative ? "Wait" : "Monitor";

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 hover:shadow-md",
        isPositive && "border-emerald-200 bg-emerald-50/30",
        isStrongNegative && "border-red-200 bg-red-50/30",
        isNeutral && "border-border"
      )}
    >
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold font-mono">{from}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold font-mono">{to}</span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              isPositive && "bg-emerald-100 text-emerald-700",
              isStrongNegative && "bg-red-100 text-red-700",
              isNeutral && "bg-amber-50 text-amber-700"
            )}
          >
            {isPositive ? <TrendingUp className="size-3" /> : isStrongNegative ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
            {label}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Mento</p>
            <p className="text-lg font-mono font-semibold">{rate.mentoRate.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Forex</p>
            <p className="text-lg font-mono font-semibold text-muted-foreground">{rate.forexRate.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Spread</p>
            <p className={cn("text-lg font-mono font-semibold", isPositive && "text-emerald-600", isStrongNegative && "text-red-600", isNeutral && "text-amber-600")}>
              {rate.spreadPct > 0 ? "+" : ""}{rate.spreadPct.toFixed(2)}%
            </p>
          </div>
        </div>
        {isPositive && (
          <p className="text-xs text-emerald-700">
            +{Math.abs(rate.spreadPct).toFixed(2)}% profitable — auto-executes above +0.3%
          </p>
        )}
        {isStrongNegative && (
          <p className="text-xs text-red-600">
            {Math.abs(rate.spreadPct).toFixed(2)}% below forex — waiting
          </p>
        )}
        {isNeutral && (
          <p className="text-xs text-amber-700">
            {rate.spreadPct > 0 ? "+" : ""}{rate.spreadPct.toFixed(2)}% — monitoring
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MentoSpreads() {
  const { data: rates, isLoading: mentoLoading, dataUpdatedAt } = useMentoData();
  const { data: crossVenue, isLoading: crossLoading } = useCrossVenueData();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const updatedAgo = dataUpdatedAt && now > 0 ? Math.floor((now - dataUpdatedAt) / 1000) : null;

  // Cross-venue pairs shown first
  const crossVenuePairs = new Set(crossVenue?.rates?.map(r => r.pair) ?? []);
  // Mento-only pairs (not covered by cross-venue)
  const mentoOnly = (rates ?? []).filter(r => !crossVenuePairs.has(r.pair));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Cross-Venue Spreads</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
            Mento + Uniswap V3
          </span>
        </div>
        {rates && (
          <div className="flex items-center gap-3">
            {updatedAgo !== null && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {updatedAgo < 5 ? "just now" : updatedAgo < 60 ? `${updatedAgo}s ago` : `${Math.floor(updatedAgo / 60)}m ago`}
              </span>
            )}
            <a
              href="https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              On-chain
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(mentoLoading && crossLoading) ? (
          <>
            <Card className="gap-0 py-0"><CardContent className="py-4"><div className="h-24 bg-muted rounded animate-pulse" /></CardContent></Card>
            <Card className="gap-0 py-0"><CardContent className="py-4"><div className="h-24 bg-muted rounded animate-pulse" /></CardContent></Card>
          </>
        ) : (
          <>
            {/* Cross-venue pairs (Mento vs Uniswap vs Forex) */}
            {crossVenue?.rates?.map((rate) => (
              <CrossVenueCard key={rate.pair} rate={rate} />
            ))}
            {/* Mento-only pairs */}
            {mentoOnly.map((rate) => (
              <SpreadCard key={rate.pair} rate={rate} />
            ))}
            {!crossVenue?.rates?.length && !rates?.length && (
              <div className="col-span-2 text-center py-6 text-muted-foreground">
                <p className="text-sm">Unable to fetch rates</p>
                <p className="text-xs mt-1">Celo RPC may be slow — refresh to retry</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
