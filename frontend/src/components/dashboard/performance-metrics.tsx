"use client";

import { useSignals } from "@/hooks/use-signals";
import { TrendingUp, Target, BarChart3, Layers } from "lucide-react";

export function PerformanceMetrics() {
  const { data: signals, isLoading } = useSignals();

  if (isLoading || !signals || signals.length === 0) return null;

  const total = signals.length;
  const avgConfidence = Math.round(
    signals.reduce((sum, s) => sum + s.confidence, 0) / total
  );
  const premiumCount = signals.filter((s) => s.tier === "premium").length;
  const markets = new Set(signals.map((s) => s.market)).size;

  // Calculate "win rate" from premium signals with entry/target
  const withTargets = signals.filter((s) => s.entryPrice && s.targetPrice);
  const bullish = withTargets.filter(
    (s) => s.direction === "long" && s.confidence >= 65
  );
  const bearish = withTargets.filter(
    (s) => s.direction === "short" && s.confidence >= 65
  );
  const highConviction = bullish.length + bearish.length;
  const winRate = highConviction > 0 ? Math.round((highConviction / withTargets.length) * 100) : 0;

  const metrics = [
    {
      label: "Signals",
      value: total.toString(),
      icon: Layers,
      detail: `${premiumCount} premium`,
    },
    {
      label: "Avg Confidence",
      value: `${avgConfidence}%`,
      icon: Target,
      detail: avgConfidence >= 70 ? "High conviction" : "Moderate",
    },
    {
      label: "Markets",
      value: markets.toString(),
      icon: BarChart3,
      detail: "Active coverage",
    },
    {
      label: "High Conviction",
      value: winRate > 0 ? `${winRate}%` : `${highConviction}`,
      icon: TrendingUp,
      detail: winRate > 0 ? "Of targeted signals" : "Signals with targets",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="border rounded-lg px-3 py-2.5 space-y-1"
        >
          <div className="flex items-center gap-1.5">
            <m.icon className="size-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </div>
          <p className="text-lg font-semibold font-mono">{m.value}</p>
          <p className="text-[10px] text-muted-foreground">{m.detail}</p>
        </div>
      ))}
    </div>
  );
}
