"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TradeFeed } from "@/components/trades/trade-feed";
import { useTrades } from "@/hooks/use-trades";
import { useMemo } from "react";
import { BarChart3, CheckCircle2, TrendingUp, Activity } from "lucide-react";

export default function TradesPage() {
  const { data: trades, isLoading } = useTrades();

  const stats = useMemo(() => {
    if (!trades?.length) return null;
    const confirmed = trades.filter((t) => t.status === "confirmed");
    const totalVolume = confirmed.reduce(
      (sum, t) => sum + parseFloat(t.amountIn),
      0
    );
    const successRate =
      trades.length > 0 ? (confirmed.length / trades.length) * 100 : 0;
    const avgSpread =
      confirmed.length > 0
        ? confirmed.reduce((sum, t) => sum + t.spreadPct, 0) /
          confirmed.length
        : 0;
    return {
      totalVolume,
      successRate,
      avgSpread,
      tradeCount: confirmed.length,
    };
  }, [trades]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every swap executed autonomously by the agent. Approval, execution, and settlement — all verifiable on Celoscan.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <BarChart3 className="size-3" />
                Volume
              </div>
              <p className="text-lg font-mono font-semibold">
                ${stats.totalVolume.toFixed(2)}
              </p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <CheckCircle2 className="size-3" />
                Success Rate
              </div>
              <p className="text-lg font-mono font-semibold text-emerald-600">
                {stats.successRate.toFixed(0)}%
              </p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="size-3" />
                Avg Spread
              </div>
              <p className="text-lg font-mono font-semibold text-emerald-600">
                +{stats.avgSpread.toFixed(2)}%
              </p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Activity className="size-3" />
                Executed
              </div>
              <p className="text-lg font-mono font-semibold">
                {stats.tradeCount}
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-muted rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <TradeFeed trades={trades ?? []} />
        )}
      </main>
      <Footer />
    </div>
  );
}
