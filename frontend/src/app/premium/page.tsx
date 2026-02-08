"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PremiumGate } from "@/components/premium/premium-gate";
import { SignalCard } from "@/components/signals/signal-card";
import { Sparkles, ArrowRight, Shield, Zap, DollarSign } from "lucide-react";

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="size-4 text-amber-500" />
              Entry/Exit Prices
            </div>
            <p className="text-xs text-muted-foreground">
              Precise entry, target, and stop-loss levels for every signal
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4 text-emerald-500" />
              Detailed Reasoning
            </div>
            <p className="text-xs text-muted-foreground">
              Full analysis from Claude AI with supporting data points
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="size-4 text-blue-500" />
              x402 Protocol
            </div>
            <p className="text-xs text-muted-foreground">
              Pay $0.01 in cUSD on Celo — no subscriptions, no tokens
            </p>
          </div>
        </div>

        <PremiumGate>
          {(signals) => (
            <div className="space-y-3">
              {signals.filter((s) => s.tier === "premium").length === 0 ? (
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

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">How x402 Payment Works</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            <span className="bg-muted rounded px-2 py-1">1. Click Unlock</span>
            <ArrowRight className="size-3 hidden sm:block" />
            <span className="bg-muted rounded px-2 py-1">2. Server returns HTTP 402</span>
            <ArrowRight className="size-3 hidden sm:block" />
            <span className="bg-muted rounded px-2 py-1">3. Wallet signs payment</span>
            <ArrowRight className="size-3 hidden sm:block" />
            <span className="bg-muted rounded px-2 py-1">4. Access granted</span>
          </div>
          <p className="text-xs text-muted-foreground">
            No gas required — EIP-712 signature authorizes cUSD transfer on Celo. Standard HTTP 402 protocol.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
