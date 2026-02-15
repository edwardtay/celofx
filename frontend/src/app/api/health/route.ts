import { NextResponse } from "next/server";
import { getTradeCount } from "@/lib/trade-store";
import { getVaultMetrics } from "@/lib/vault-store";
import { getTrades } from "@/lib/trade-store";
import { getAgentStatus, getDecisionLog } from "@/lib/agent-policy";
import { getAttestation } from "@/lib/tee";

export async function GET() {
  const trades = getTrades();
  const tradeCount = getTradeCount();
  const vault = getVaultMetrics(trades);
  const agentStatus = getAgentStatus();
  const decisions = getDecisionLog();
  const tee = await getAttestation();

  const confirmedTrades = trades.filter(t => t.status === "confirmed");
  const latestTrade = confirmedTrades[0];

  return NextResponse.json({
    status: agentStatus.paused ? "paused" : "healthy",
    agentId: 10,
    chain: "celo",
    chainId: 42220,
    timestamp: new Date().toISOString(),
    agent: {
      paused: agentStatus.paused,
      dailyVolumeUsed: agentStatus.dailyVolume,
      dailyVolumeLimit: agentStatus.dailyLimit,
      dailyVolumeRemaining: Math.max(0, agentStatus.dailyLimit - agentStatus.dailyVolume),
      decisionsLogged: agentStatus.decisionsLogged,
      lastDecision: decisions.length > 0 ? new Date(decisions[decisions.length - 1].timestamp).toISOString() : null,
      tools: 16,
      model: "claude-sonnet-4-5-20250929",
    },
    tee: {
      status: tee.status,
      verified: tee.verified,
      infrastructure: tee.verified ? "Intel TDX (Phala Cloud)" : "Vercel",
    },
    services: {
      a2a: { status: "up", skills: 4 },
      mcp: { status: "up", tools: 9, protocolVersion: "2025-06-18" },
      x402: { status: "up", price: "$0.10", currency: "cUSD" },
      web: { status: "up" },
    },
    stats: {
      trades: tradeCount,
      confirmedTrades: confirmedTrades.length,
      successRate: trades.length > 0 ? Math.round((confirmedTrades.length / trades.length) * 100) : 100,
      totalVolume: confirmedTrades.reduce((sum, t) => sum + parseFloat(t.amountIn), 0),
      vaultTvl: vault.tvl,
      vaultDepositors: vault.depositors,
      latestTrade: latestTrade ? {
        pair: latestTrade.pair,
        timestamp: new Date(latestTrade.timestamp).toISOString(),
        celoscan: latestTrade.swapTxHash ? `https://celoscan.io/tx/${latestTrade.swapTxHash}` : null,
      } : null,
    },
  });
}
