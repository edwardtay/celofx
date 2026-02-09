"use client";

import { useSignals } from "@/hooks/use-signals";
import { SignalCard } from "@/components/signals/signal-card";
import { Zap } from "lucide-react";

export function TopSignals() {
  const { data: signals, isLoading } = useSignals();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-muted rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const topSignals = (signals ?? [])
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  if (topSignals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <Zap className="size-6 opacity-40" />
          <p className="text-sm">Click &quot;Run Analysis&quot; above to generate AI signals</p>
          <p className="text-xs">Agent #4 will scan Mento FX, forex, crypto, and commodities</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topSignals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
