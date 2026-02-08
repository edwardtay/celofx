import { Navbar } from "@/components/navbar";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { TopSignals } from "@/components/dashboard/top-signals";
import { AgentStatus } from "@/components/dashboard/agent-status";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time alpha across crypto, stocks, forex, and commodities
          </p>
        </div>

        <AgentStatus />
        <MarketOverview />

        <div>
          <h2 className="text-lg font-semibold mb-3">Top Signals</h2>
          <TopSignals />
        </div>
      </main>
    </div>
  );
}
