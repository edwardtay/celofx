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

  return (
    <div className="space-y-3">
      {topSignals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
      {topSignals.length > 0 && (
        <Link
          href="/signals"
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          View all signals
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
