import { NextResponse } from "next/server";
import { getTrades, getTradeCount } from "@/lib/trade-store";
import { getAttestation } from "@/lib/tee";

export async function GET() {
  const teeAttestation = await getAttestation();
  const allTrades = getTrades();
  const confirmed = allTrades.filter((t) => t.status === "confirmed");
  const failed = allTrades.filter((t) => t.status === "failed");

  const totalVolume = confirmed.reduce(
    (sum, t) => sum + parseFloat(t.amountIn),
    0
  );
  const avgSpread =
    confirmed.length > 0
      ? confirmed.reduce((sum, t) => sum + t.spreadPct, 0) / confirmed.length
      : 0;
  const cumulativePnl = confirmed.reduce(
    (sum, t) => sum + (t.pnl ?? 0),
    0
  );

  const pairs = [...new Set(confirmed.map((t) => t.pair))];
  const sorted = [...confirmed].sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({
    agentId: 10,
    wallet: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
    chain: "celo",
    registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    tee: {
      status: teeAttestation.status,
      verified: teeAttestation.verified,
      timestamp: teeAttestation.timestamp,
      hardware: "Intel TDX",
      provider: "Phala Cloud",
    },
    performance: {
      totalTrades: getTradeCount(),
      confirmedTrades: confirmed.length,
      failedTrades: failed.length,
      successRate:
        allTrades.length > 0
          ? Math.round((confirmed.length / allTrades.length) * 100)
          : 0,
      totalVolume: parseFloat(totalVolume.toFixed(4)),
      avgSpreadCaptured: parseFloat(avgSpread.toFixed(4)),
      cumulativePnlPct: parseFloat(cumulativePnl.toFixed(4)),
      pairsTraded: pairs,
    },
    latestTrade: sorted[0]
      ? {
          pair: sorted[0].pair,
          amountIn: sorted[0].amountIn,
          amountOut: sorted[0].amountOut,
          rate: sorted[0].rate,
          spreadPct: sorted[0].spreadPct,
          swapTxHash: sorted[0].swapTxHash,
          timestamp: sorted[0].timestamp,
        }
      : null,
    trades: confirmed.map((t) => ({
      id: t.id,
      pair: t.pair,
      amountIn: t.amountIn,
      amountOut: t.amountOut,
      rate: t.rate,
      spreadPct: t.spreadPct,
      pnl: t.pnl,
      swapTxHash: t.swapTxHash,
      approvalTxHash: t.approvalTxHash,
      timestamp: t.timestamp,
    })),
  });
}
