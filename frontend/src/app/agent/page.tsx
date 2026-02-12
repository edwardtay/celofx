"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentIdentityCard } from "@/components/agent/agent-identity-card";
import { ReputationDisplay } from "@/components/agent/reputation-display";
import { ReputationForm } from "@/components/agent/reputation-form";
import { OnChainMetadata } from "@/components/agent/on-chain-metadata";
import { ExecutionTimeline } from "@/components/agent/execution-timeline";
import { AgenticArchitecture } from "@/components/agent/agentic-architecture";
import { TechIntegrations } from "@/components/agent/tech-integrations";
import { SelfClawBadge } from "@/components/dashboard/selfclaw-badge";
import { ExternalLink, ShieldCheck, Database, Code2, Activity } from "lucide-react";

export default function AgentPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            FX Arbitrage Agent
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identity and reputation stored permanently on Celo via ERC-8004
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

        <SelfClawBadge />

        <OnChainMetadata />

        <AgenticArchitecture />

        <ExecutionTimeline />

        <TechIntegrations />

        {/* Public API & Execution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-blue-500" />
              <h3 className="text-sm font-medium">Track Record API</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Public JSON endpoint for verifying agent performance programmatically. No auth required.
            </p>
            <div className="bg-muted/50 border rounded-lg p-2 overflow-x-auto">
              <code className="text-[11px] font-mono text-muted-foreground">
                GET /api/agent/track-record
              </code>
            </div>
            <a
              href="/api/agent/track-record"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
              View live response
            </a>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <h3 className="text-sm font-medium">Autonomous Execution</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Cloudflare Worker scans markets every 15 min, compares Mento on-chain rates with forex, and auto-executes swaps when spreads exceed 0.3%.
            </p>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span>Cron: every 15 min (Cloudflare Worker)</span>
              <span>Threshold: spread &gt; 0.3%</span>
              <span>Wallet: 0x6652...303</span>
            </div>
          </div>
        </div>

        {/* On-chain verification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              <h3 className="text-sm font-medium">Verified On-Chain</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Every rating is permanent. Nobody — not even us — can edit or remove feedback once submitted. All transactions verifiable on Celoscan.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="size-3" />
              ERC-8004 Reputation Registry on Celo mainnet
            </div>
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
                ERC-8004 registration (#10)
              </a>
              <a
                href="https://celoscan.io/tx/0x238e1f606bcdab5789ef4f7dc5c69147e2ff5779bfd2a69605de3793636be70c"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 90/100 — Mento spread timing
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
                Feedback: 95/100 — Mento spread timing
              </a>
              <a
                href="https://celoscan.io/tx/0x84bc5016754b09645716487392667d2331c894fc48512eda39a901fdcad424ad"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 shrink-0" />
                Feedback: 75/100 — FX spread accuracy
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
