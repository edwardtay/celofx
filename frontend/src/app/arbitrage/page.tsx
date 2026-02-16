"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { MentoSpreads } from "@/components/dashboard/mento-spreads";
import { LiveStats } from "@/components/dashboard/live-stats";
import { TopSignals } from "@/components/dashboard/top-signals";
import { ProtocolHealth } from "@/components/dashboard/protocol-health";

export default function ArbitragePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        <section className="rounded-xl border bg-card p-5">
          <h1 className="text-2xl font-display tracking-tight">Arbitrage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor live spreads and execute directly when opportunities are profitable.
          </p>
          <div className="mt-3">
            <LiveStats />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/trading"
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Open Trading <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/trades"
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2.5 text-sm hover:bg-accent/50"
            >
              View Trades <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Delegate Capital</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Deposit into the hedge vault for proportional exposure to agent-managed returns.
              </p>
            </div>
            <Link
              href="/hedge"
              className="inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs hover:bg-accent/50"
            >
              Open Hedge <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <MentoSpreads />
        </section>

        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Top signals
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-4 pb-4">
            <TopSignals />
          </div>
        </details>

        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Agent status
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-4 pb-4">
            <AgentStatus />
          </div>
        </details>

        <details className="rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Diagnostics
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-4 pb-4">
            <ProtocolHealth />
          </div>
        </details>
      </main>
      <Footer />
    </div>
  );
}
