"use client";

import { Suspense, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PremiumGate } from "@/components/premium/premium-gate";
import { SignalCard } from "@/components/signals/signal-card";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  DollarSign,
  Code2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

const x402ResponseExample = `// GET /api/premium-signals -> HTTP 402

{
  "x402Version": 2,
  "resource": {
    "url": "/api/premium-signals",
    "description": "Access premium alpha signals",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:42220",
    "asset": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    "amount": "10000",
    "maxTimeoutSeconds": 300
  }]
}`;

export default function PremiumPage() {
  const [showSpec, setShowSpec] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5" />
            <h1 className="text-2xl font-display tracking-tight">Premium Signals</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Deep analysis with entry prices, targets, and stop losses — $0.01 per unlock via x402
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="size-4 text-amber-500" />
              Exact Levels
            </div>
            <p className="text-xs text-muted-foreground">
              Entry price, take-profit target, and stop-loss for every signal
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4 text-emerald-500" />
              Full Reasoning
            </div>
            <p className="text-xs text-muted-foreground">
              Why the agent made this call — data, technicals, cross-market context
            </p>
          </div>
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="size-4 text-blue-500" />
              Pay Per Signal
            </div>
            <p className="text-xs text-muted-foreground">
              $0.01 per unlock — no subscription, no token gate, instant access
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="h-64 bg-muted rounded-xl animate-pulse" />}>
          <PremiumGate>
            {(signals) => (
              <div className="space-y-3">
                {signals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <BarChart3 className="size-6 mx-auto opacity-40" />
                    <p className="text-sm">No signals loaded</p>
                    <Link href="/" className="text-xs underline underline-offset-2 hover:text-foreground transition-colors">
                      Go to dashboard and click &quot;Scan Markets&quot; first
                    </Link>
                  </div>
                ) : (
                  signals.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))
                )}
              </div>
            )}
          </PremiumGate>
        </Suspense>

        {/* x402 Protocol Details — collapsed by default */}
        <div className="border rounded-lg p-4 space-y-3">
          <button
            onClick={() => setShowSpec(!showSpec)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">How x402 Payment Works</h3>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://www.x402.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                x402.org <ExternalLink className="size-2.5" />
              </a>
              {showSpec ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {showSpec && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                <span className="bg-muted rounded px-2 py-1">1. Click Unlock</span>
                <ArrowRight className="size-3 hidden sm:block" />
                <span className="bg-muted rounded px-2 py-1">2. Server returns HTTP 402</span>
                <ArrowRight className="size-3 hidden sm:block" />
                <span className="bg-muted rounded px-2 py-1">3. Wallet signs EIP-712</span>
                <ArrowRight className="size-3 hidden sm:block" />
                <span className="bg-muted rounded px-2 py-1">4. cUSD settled on Celo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No gas fees — you sign a message, the payment settles instantly on Celo.
              </p>

              <div className="bg-muted/50 border rounded-lg p-3 overflow-x-auto">
                <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre">
                  {x402ResponseExample}
                </pre>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                  <span>
                    <strong className="text-foreground">network</strong>: Celo Mainnet (42220)
                  </span>
                  <span>
                    <strong className="text-foreground">asset</strong>: cUSD
                  </span>
                  <span>
                    <strong className="text-foreground">amount</strong>: 10000 = $0.01 (6 decimals)
                  </span>
                  <span>
                    <strong className="text-foreground">scheme</strong>: exact (no facilitator)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
