"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TradeFeed } from "@/components/trades/trade-feed";
import { useTrades } from "@/hooks/use-trades";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle2, TrendingUp, Activity, ExternalLink, ShieldCheck, ArrowRight, Trophy, Target } from "lucide-react";
import type { Trade } from "@/lib/types";

// ─── P&L Sparkline Chart ───
function PnlChart({ trades }: { trades: Trade[] }) {
  const confirmed = trades
    .filter((t) => t.status === "confirmed" && t.pnl != null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (confirmed.length < 2) return null;

  // Build cumulative P&L series
  let cumulative = 0;
  const points = confirmed.map((t) => {
    cumulative += t.pnl ?? 0;
    return cumulative;
  });

  const min = Math.min(0, ...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 300;
  const h = 56;
  const padding = 4;

  const coords = points.map(
    (p, i) =>
      `${padding + (i / (points.length - 1)) * (w - padding * 2)},${
        padding + (h - padding * 2) - ((p - min) / range) * (h - padding * 2)
      }`
  );

  const lastX = padding + ((points.length - 1) / (points.length - 1)) * (w - padding * 2);
  const firstX = padding;
  const zeroY = padding + (h - padding * 2) - ((0 - min) / range) * (h - padding * 2);
  const areaPath = `M${coords[0]} ${coords.slice(1).map((c) => `L${c}`).join(" ")} L${lastX},${zeroY} L${firstX},${zeroY} Z`;

  const isPositive = cumulative >= 0;

  return (
    <div className="space-y-1">
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Zero line */}
        <line
          x1={padding}
          y1={zeroY}
          x2={w - padding}
          y2={zeroY}
          stroke="currentColor"
          strokeDasharray="3 3"
          className="text-muted-foreground/30"
          strokeWidth={0.5}
        />
        {/* Area */}
        <path
          d={areaPath}
          fill={isPositive ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}
        />
        {/* Line */}
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={parseFloat(coords[coords.length - 1].split(",")[0])}
          cy={parseFloat(coords[coords.length - 1].split(",")[1])}
          r={2.5}
          fill={isPositive ? "#10b981" : "#ef4444"}
        />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>Trade 1</span>
        <span className={isPositive ? "text-emerald-600" : "text-red-600"}>
          {isPositive ? "+" : ""}{cumulative.toFixed(2)}% cumulative
        </span>
      </div>
    </div>
  );
}

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

    // P&L analytics
    const wins = confirmed.filter((t) => (t.pnl ?? 0) > 0);
    const losses = confirmed.filter((t) => (t.pnl ?? 0) <= 0);
    const winRate = confirmed.length > 0 ? (wins.length / confirmed.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;
    const bestTrade = confirmed.reduce((best, t) => ((t.pnl ?? 0) > (best.pnl ?? 0) ? t : best), confirmed[0]);
    const worstTrade = confirmed.reduce((worst, t) => ((t.pnl ?? 0) < (worst.pnl ?? 0) ? t : worst), confirmed[0]);

    // Pair breakdown
    const pairStats = new Map<string, { count: number; pnl: number; volume: number }>();
    for (const t of confirmed) {
      const existing = pairStats.get(t.pair) || { count: 0, pnl: 0, volume: 0 };
      existing.count++;
      existing.pnl += t.pnl ?? 0;
      existing.volume += parseFloat(t.amountIn);
      pairStats.set(t.pair, existing);
    }

    return {
      totalVolume,
      successRate,
      avgSpread,
      tradeCount: confirmed.length,
      cumulativePnl,
      winRate,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      pairStats,
    };
  }, [trades]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every swap executed by the agent — all verifiable on Celoscan.
          </p>
        </div>

        {stats && (
          <>
            {/* Key Stats */}
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

            {/* P&L Chart + Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Cumulative P&L Chart */}
              <Card className="gap-0 py-0">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Cumulative P&L</span>
                  </div>
                  {trades && trades.length >= 2 ? (
                    <PnlChart trades={trades} />
                  ) : (
                    <p className="text-xs text-muted-foreground py-4">
                      Need at least 2 trades to show chart
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Performance Analytics */}
              <Card className="gap-0 py-0">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Performance</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-mono font-bold text-emerald-600">
                        {stats.winRate.toFixed(0)}%
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Avg Win</p>
                      <p className="text-lg font-mono font-bold text-emerald-600">
                        +{stats.avgWin.toFixed(2)}%
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Avg Loss</p>
                      <p className="text-lg font-mono font-bold text-muted-foreground">
                        {stats.avgLoss === 0 ? "—" : `${stats.avgLoss.toFixed(2)}%`}
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Best Trade</p>
                      <p className="text-sm font-mono font-bold text-emerald-600">
                        {stats.bestTrade?.pair} +{(stats.bestTrade?.pnl ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Pair breakdown */}
                  {stats.pairStats.size > 0 && (
                    <div className="space-y-1.5 border-t pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                        <Target className="size-2.5" />
                        By Pair
                      </p>
                      {[...stats.pairStats.entries()].map(([pair, data]) => (
                        <div
                          key={pair}
                          className="flex items-center justify-between text-xs px-2 py-1 rounded border"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pair}</span>
                            <span className="text-muted-foreground">{data.count} trades</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground">
                              ${data.volume.toFixed(0)}
                            </span>
                            <span className={`font-mono font-medium ${data.pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {data.pnl >= 0 ? "+" : ""}{data.pnl.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Verified On-Chain Swaps */}
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
                {confirmed.slice(0, 6).map((trade) => (
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
