"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentIdentityCard } from "@/components/agent/agent-identity-card";
import { ReputationDisplay } from "@/components/agent/reputation-display";
import { ReputationForm } from "@/components/agent/reputation-form";
import { Fingerprint, Star, ArrowRight, Users, ExternalLink } from "lucide-react";

export default function AgentPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            Agent Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            On-chain identity and reputation via ERC-8004
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <AgentIdentityCard />
            <ReputationForm />
          </div>
          <div className="lg:col-span-2">
            <ReputationDisplay />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">How ERC-8004 Works</h3>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
                <Fingerprint className="size-3" />
                1. Agent registers identity on-chain
              </span>
              <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
                <Star className="size-3" />
                2. Users rate signal quality
              </span>
              <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
                <Users className="size-3" />
                3. Reputation builds immutably
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              No platform can manipulate scores — all data is on Celo.
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">On-Chain Proof</h3>
            <div className="flex flex-col gap-2 text-xs">
              <a
                href="https://celoscan.io/tx/0xea64b5d790028208b285bb05a00cb506b44f7fa6d10099cff6671bd42e9a3ab6"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Agent #4 registration
              </a>
              <a
                href="https://celoscan.io/tx/0x238e1f606bcdab5789ef4f7dc5c69147e2ff5779bfd2a69605de3793636be70c"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 90/100 — BTC call accuracy
              </a>
              <a
                href="https://celoscan.io/tx/0xfb08a317148df32a911813d400883dd7f5a53ce20bdb33a7745f8050ef9d3199"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 80/100 — Forex signals
              </a>
              <a
                href="https://celoscan.io/tx/0x40ec63fe091e54c1181304d19c0348721092716b4dd0088e30f7bee0d9fa493c"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 95/100 — SOL short accuracy
              </a>
              <a
                href="https://celoscan.io/tx/0x84bc5016754b09645716487392667d2331c894fc48512eda39a901fdcad424ad"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 75/100 — Stock signals
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              All transactions verifiable on Celoscan
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
