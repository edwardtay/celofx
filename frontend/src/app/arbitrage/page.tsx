"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { MentoSpreads } from "@/components/dashboard/mento-spreads";
import { TopSignals } from "@/components/dashboard/top-signals";

export default function ArbitragePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-6 py-6">
        <h1 className="text-2xl font-display tracking-tight">Arbitrage</h1>

        <div className="rounded-xl border bg-card p-5">
          <MentoSpreads />
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Signals</p>
          <TopSignals />
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Agent</p>
          <AgentStatus />
        </div>
      </main>
      <Footer />
    </div>
  );
}
