import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { TopSignals } from "@/components/dashboard/top-signals";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { ReputationBadge } from "@/components/dashboard/reputation-badge";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import { MarketSentiment } from "@/components/dashboard/market-sentiment";
import { TrackRecord } from "@/components/dashboard/track-record";
import { Shield, Zap, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display tracking-tight">$AAA</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              AI-generated trading signals across crypto, stocks, forex, and commodities. Every signal is backed by an on-chain track record you can verify.
            </p>
          </div>
          <ReputationBadge />
        </div>

        <AgentStatus />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Top Signals</h2>
            <Link
              href="/signals"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <TopSignals />
        </div>

        <MarketOverview />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PerformanceMetrics />
          <MarketSentiment />
        </div>

        <TrackRecord />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/agent" className="flex items-start gap-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors group">
            <Shield className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Verifiable Identity</p>
                <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground">
                This agent&apos;s identity is registered on-chain — you can verify who built it and when
              </p>
            </div>
          </Link>
          <Link href="/agent" className="flex items-start gap-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors group">
            <BarChart3 className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Provable Track Record</p>
                <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground">
                Users rate signal quality on-chain — reputation is public and immutable
              </p>
            </div>
          </Link>
          <Link href="/premium?demo=true" className="flex items-start gap-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors group">
            <Zap className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">$0.01 Per Signal</p>
                <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground">
                Unlock premium signals with a one-cent micropayment — no subscription needed
              </p>
            </div>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
