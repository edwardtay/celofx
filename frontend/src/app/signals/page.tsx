"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SignalFeed } from "@/components/signals/signal-feed";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { useSignals } from "@/hooks/use-signals";

export default function SignalsPage() {
  const { data: signals, isLoading } = useSignals();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated trading signals across all markets
          </p>
        </div>

        <AgentStatus />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-32 bg-muted rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <SignalFeed signals={signals ?? []} />
        )}
      </main>
      <Footer />
    </div>
  );
}
