"use client";

import { useSignals } from "@/hooks/use-signals";
import { TrendingUp, Target, BarChart3, Layers } from "lucide-react";

export function PerformanceMetrics() {
  const { data: signals, isLoading } = useSignals();

  if (isLoading) return null;

  if (!signals || signals.length === 0) {
    return (
      <div className="border rounded-lg p-3 grid grid-cols-2 gap-3">
        {["Signals", "Avg Confidence", "Markets", "High Conviction"].map((label) => (
          <div key={label} className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">{label}</span>
            <p className="text-lg font-semibold font-mono leading-tight text-muted-foreground/30">—</p>
          </div>
        ))}
      </div>
    );
  }

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

  const mentoCount = signals.filter((s) => s.market === "mento").length;

  const metrics = [
    {
      label: "FX Signals",
      value: total.toString(),
      icon: Layers,
      detail: `${mentoCount} Mento swaps`,
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
      detail: "FX pairs tracked",
    },
    {
      label: "Swap Signals",
      value: winRate > 0 ? `${winRate}%` : `${highConviction}`,
      icon: TrendingUp,
      detail: winRate > 0 ? "With positive spreads" : "Actionable swaps",
    },
  ];

  return (
    <div className="border rounded-lg p-3 grid grid-cols-2 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <m.icon className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{m.label}</span>
          </div>
          <p className="text-lg font-semibold font-mono leading-tight">{m.value}</p>
          <p className="text-[10px] text-muted-foreground">{m.detail}</p>
        </div>
      ))}
    </div>
  );
}
