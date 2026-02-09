"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TradeFeed } from "@/components/trades/trade-feed";
import { useTrades } from "@/hooks/use-trades";

export default function TradesPage() {
  const { data: trades, isLoading } = useTrades();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every swap executed autonomously by the agent. Approval, execution, and settlement — all on-chain.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 bg-muted rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <TradeFeed trades={trades ?? []} />
        )}
      </main>
      <Footer />
    </div>
  );
}
