"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { MentoSpreads } from "@/components/dashboard/mento-spreads";
import { LiveStats } from "@/components/dashboard/live-stats";
import { TopSignals } from "@/components/dashboard/top-signals";
import { ProtocolHealth } from "@/components/dashboard/protocol-health";

export default function ArbitragePage() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6 space-y-6">
        <section className="rounded-xl border bg-card p-6">
          <h1 className="text-2xl font-display tracking-tight">Arbitrage</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track current spread opportunities and execute only when profitable. Focus on the live spread panel and
            action buttons below.
          </p>
          <div className="mt-4">
            <LiveStats />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/trading"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent/50"
            >
              Open Execution <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/trades"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent/50"
            >
              View Recent Trades <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        <AgentStatus />
        <MentoSpreads />

        <section className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Signals</h2>
            <Link
              href="/signals"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="mt-3">
            <TopSignals />
          </div>
        </section>

        <button
          onClick={() => setShowDiagnostics((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          {showDiagnostics ? "Hide" : "Show"} diagnostics
          <ChevronDown className={`size-4 transition-transform ${showDiagnostics ? "rotate-180" : ""}`} />
        </button>

        {showDiagnostics && (
          <section className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
            <ProtocolHealth />
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
