"use client";

import { useSignals } from "@/hooks/use-signals";
import { SignalCard } from "@/components/signals/signal-card";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
        <p className="text-sm">No signals yet. Click &quot;Run Analysis&quot; above to generate signals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topSignals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
      <Link
        href="/signals"
        className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        View all signals
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
