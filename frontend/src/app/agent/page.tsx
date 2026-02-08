"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentIdentityCard } from "@/components/agent/agent-identity-card";
import { ReputationDisplay } from "@/components/agent/reputation-display";
import { ReputationForm } from "@/components/agent/reputation-form";
import { Fingerprint, Star, ArrowRight, Users } from "lucide-react";

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

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">How ERC-8004 Works</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
              <Fingerprint className="size-3" />
              1. Agent registers identity
            </span>
            <ArrowRight className="size-3 hidden sm:block" />
            <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
              <Star className="size-3" />
              2. Users rate signal quality
            </span>
            <ArrowRight className="size-3 hidden sm:block" />
            <span className="bg-muted rounded px-2 py-1 flex items-center gap-1">
              <Users className="size-3" />
              3. Reputation builds on-chain
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Identity and reputation are stored on Celo via ERC-8004 registries. Feedback is immutable and publicly verifiable — no platform can manipulate scores.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
