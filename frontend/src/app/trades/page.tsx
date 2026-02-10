"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TradeFeed } from "@/components/trades/trade-feed";
import { useTrades } from "@/hooks/use-trades";
import { useMemo } from "react";
import { BarChart3, CheckCircle2, TrendingUp, Activity, ExternalLink, ShieldCheck, ArrowRight } from "lucide-react";

export default function TradesPage() {
  const { data: trades, isLoading } = useTrades();

  const stats = useMemo(() => {
    if (!trades?.length) return null;
    const confirmed = trades.filter((t) => t.status === "confirmed");
    const failed = trades.filter((t) => t.status === "failed");
    const settled = confirmed.length + failed.length;
    const totalVolume = confirmed.reduce(
      (sum, t) => sum + parseFloat(t.amountIn),
      0
    );
    const successRate =
      settled > 0 ? (confirmed.length / settled) * 100 : 0;
    const avgSpread =
      confirmed.length > 0
        ? confirmed.reduce((sum, t) => sum + t.spreadPct, 0) /
          confirmed.length
        : 0;
    const cumulativePnl = confirmed.reduce(
      (sum, t) => sum + (t.pnl ?? 0),
      0
    );
    return {
      totalVolume,
      successRate,
      avgSpread,
      tradeCount: confirmed.length,
      cumulativePnl,
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Activity className="size-3" />
                Executed
              </div>
              <p className="text-lg font-mono font-semibold">
                {stats.tradeCount}
              </p>
            </div>
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
                <TrendingUp className="size-3" />
                Spread Captured
              </div>
              <p className={`text-lg font-mono font-semibold ${stats.cumulativePnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {stats.cumulativePnl >= 0 ? "+" : ""}{stats.cumulativePnl.toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Verified On-Chain Swaps — the 3 real executed trades */}
        {stats && stats.tradeCount > 0 && (() => {
          const confirmed = (trades ?? []).filter((t) => t.status === "confirmed" && t.swapTxHash);
          if (confirmed.length === 0) return null;
          return (
            <div className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <h2 className="text-sm font-semibold">Verified On-Chain Swaps</h2>
                <span className="text-[10px] text-emerald-600 font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{confirmed.length} confirmed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {confirmed.map((trade) => (
                  <div key={trade.id} className="bg-background border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{trade.pair}</span>
                      <span className="text-emerald-600 text-xs font-mono font-semibold">+{trade.spreadPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>{trade.amountIn} {trade.fromToken}</span>
                      <ArrowRight className="size-3" />
                      <span>{trade.amountOut} {trade.toToken}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://celoscan.io/tx/${trade.swapTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-800 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        Celoscan
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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
