"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MentoSpreads } from "@/components/dashboard/mento-spreads";
import { TopSignals } from "@/components/dashboard/top-signals";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { AgentWallet } from "@/components/dashboard/agent-wallet";
import { ReputationBadge } from "@/components/dashboard/reputation-badge";
import { SelfClawBadge } from "@/components/dashboard/selfclaw-badge";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import { TrackRecord } from "@/components/dashboard/track-record";
import { AutonomousLoop } from "@/components/dashboard/autonomous-loop";
import { VaultOverview } from "@/components/vault/vault-overview";
import { LiveStats } from "@/components/dashboard/live-stats";
import { OnchainHistory } from "@/components/dashboard/onchain-history";
import { ProtocolHealth } from "@/components/dashboard/protocol-health";
import { ChevronDown, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display tracking-tight">Arbitrage</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              Monitors Mento stablecoin rates 24/7 — only trades when the spread is profitable.
            </p>
            <LiveStats />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SelfClawBadge compact />
            <ReputationBadge />
          </div>
        </div>

        {/* Core: Agent + Vault + Spreads */}
        <AgentStatus />
        <VaultOverview />
        <MentoSpreads />

        {/* Signals */}
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

        {/* Expandable details section */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {showDetails ? "Hide" : "Show"} agent details
          <ChevronDown
            className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
        </button>

        {showDetails && (
          <div className="space-y-6 animate-in slide-in-from-top-2 fade-in duration-300">
            <AgentWallet />
            <OnchainHistory />
            <ProtocolHealth />
            <AutonomousLoop />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PerformanceMetrics />
              <TrackRecord />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
