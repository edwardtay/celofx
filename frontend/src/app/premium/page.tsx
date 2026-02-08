"use client";

import { Navbar } from "@/components/navbar";
import { PremiumGate } from "@/components/premium/premium-gate";
import { SignalCard } from "@/components/signals/signal-card";
import { Sparkles } from "lucide-react";

export default function PremiumPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5" />
            <h1 className="text-2xl font-display tracking-tight">Premium</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Deep analysis with entry prices, targets, and stop losses
          </p>
        </div>

        <PremiumGate>
          {(signals) => (
            <div className="space-y-3">
              {signals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No premium signals available yet. Run agent analysis first.
                </div>
              ) : (
                signals
                  .filter((s) => s.tier === "premium")
                  .map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))
              )}
            </div>
          )}
        </PremiumGate>
      </main>
    </div>
  );
}
