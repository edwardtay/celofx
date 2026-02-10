"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useMentoData } from "@/hooks/use-market-data";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import type { MentoRate } from "@/lib/market-data";

function SpreadCard({ rate }: { rate: MentoRate }) {
  const isPositive = rate.spreadPct > 0.2;
  const isStrongNegative = rate.spreadPct < -0.5;
  const isNeutral = !isPositive && !isStrongNegative;

  const [from, to] = rate.pair.split("/");

  // Label logic: positive = Opportunity, strong negative = Avoid, everything else = Monitor
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
        {/* Pair header */}
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
            {isPositive ? (
              <TrendingUp className="size-3" />
            ) : isStrongNegative ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {label}
          </div>
        </div>

        {/* Rate comparison */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Mento Rate
            </p>
            <p className="text-lg font-mono font-semibold">{rate.mentoRate.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Forex Rate
            </p>
            <p className="text-lg font-mono font-semibold text-muted-foreground">
              {rate.forexRate.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Spread
            </p>
            <p
              className={cn(
                "text-lg font-mono font-semibold",
                isPositive && "text-emerald-600",
                isStrongNegative && "text-red-600",
                isNeutral && "text-amber-600"
              )}
            >
              {rate.spreadPct > 0 ? "+" : ""}
              {rate.spreadPct.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Action hint */}
        {isPositive && (
          <p className="text-xs text-emerald-700">
            Mento gives {Math.abs(rate.spreadPct).toFixed(2)}% more {to} per {from} than real forex — auto-executes above 0.3%
          </p>
        )}
        {isStrongNegative && (
          <p className="text-xs text-red-600">
            Spread at {rate.spreadPct.toFixed(2)}% — agent waiting for oracle update (threshold: +0.3%)
          </p>
        )}
        {isNeutral && (
          <p className="text-xs text-amber-700">
            Spread at {rate.spreadPct > 0 ? "+" : ""}{rate.spreadPct.toFixed(2)}% — agent monitoring, auto-executes above +0.3%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MentoSpreads() {
  const { data: rates, isLoading } = useMentoData();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Mento FX Spreads</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
            Broker 0x777A...4CaD
          </span>
        </div>
        {rates && (
          <a
            href="https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            On-chain via getAmountOut()
            <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Card className="gap-0 py-0">
              <CardContent className="py-4">
                <div className="h-24 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
            <Card className="gap-0 py-0">
              <CardContent className="py-4">
                <div className="h-24 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          </>
        ) : rates && rates.length > 0 ? (
          rates.map((rate) => <SpreadCard key={rate.pair} rate={rate} />)
        ) : (
          <div className="col-span-2 text-center py-6 text-muted-foreground">
            <p className="text-sm">Unable to fetch Mento rates</p>
            <p className="text-xs mt-1">Celo RPC may be slow — refresh to retry</p>
          </div>
        )}
      </div>
    </div>
  );
}
