"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentIdentityCard } from "@/components/agent/agent-identity-card";
import { ReputationDisplay } from "@/components/agent/reputation-display";
import { ReputationForm } from "@/components/agent/reputation-form";

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
      </main>
      <Footer />
    </div>
  );
}
