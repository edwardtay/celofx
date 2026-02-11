import { NextResponse } from "next/server";
import { getTradeCount } from "@/lib/trade-store";
import { getVaultMetrics } from "@/lib/vault-store";
import { getTrades } from "@/lib/trade-store";

export async function GET() {
  const trades = getTrades();
  const tradeCount = getTradeCount();
  const vault = getVaultMetrics(trades);

  return NextResponse.json({
    status: "healthy",
    agentId: 10,
    chain: "celo",
    timestamp: new Date().toISOString(),
    services: {
      a2a: { status: "up", skills: 4 },
      mcp: { status: "up", tools: 5 },
      web: { status: "up" },
      tee: { status: "active" },
    },
    stats: {
      trades: tradeCount,
      vaultTvl: vault.tvl,
      vaultDepositors: vault.depositors,
    },
  });
}
