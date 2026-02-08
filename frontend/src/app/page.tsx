import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { TopSignals } from "@/components/dashboard/top-signals";
import { AgentStatus } from "@/components/dashboard/agent-status";
import { Shield, Zap, BarChart3 } from "lucide-react";

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-3 border rounded-lg p-3">
            <Shield className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Verifiable Identity</p>
              <p className="text-xs text-muted-foreground">
                Agent #4 registered on ERC-8004 Identity Registry on Celo
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border rounded-lg p-3">
            <BarChart3 className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">On-Chain Reputation</p>
              <p className="text-xs text-muted-foreground">
                Signal quality tracked via ERC-8004 Reputation Registry
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border rounded-lg p-3">
            <Zap className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Pay Per Signal</p>
              <p className="text-xs text-muted-foreground">
                Premium signals via x402 micropayments — $0.01 in cUSD
              </p>
            </div>
          </div>
        </div>

        <AgentStatus />
        <MarketOverview />

        <div>
          <h2 className="text-lg font-semibold mb-3">Top Signals</h2>
          <TopSignals />
        </div>
      </main>
      <Footer />
    </div>
  );
}
