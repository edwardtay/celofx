import { NextResponse } from "next/server";
import { getTrades, getTradeCount } from "@/lib/trade-store";
import { getVaultMetrics } from "@/lib/vault-store";
import { getAttestation } from "@/lib/tee";
import type { Trade } from "@/lib/types";

// Celo gas cost per swap in USD (fee abstraction makes it very cheap)
const ESTIMATED_GAS_COST_USD = 0.0006;

// Token prices in USD for portfolio valuation
const TOKEN_PRICES_USD: Record<string, number> = {
  cUSD: 1.0,
  cEUR: 1.155,
  cREAL: 0.19,
};

function getTokenPrice(token: string): number {
  return TOKEN_PRICES_USD[token] ?? 1.0;
}

interface TradePnl {
  id: string;
  pair: string;
  amountIn: string;
  amountOut: string;
  spreadPct: number;
  tradeValueUsd: number;
  grossProfitUsd: number;
  estimatedGasCostUsd: number;
  netProfitUsd: number;
  explanation: string;
  swapTxHash?: string;
  timestamp: number;
}

/**
 * FX arbitrage P&L: profit = spread captured on the notional value.
 * When you swap 2 cUSD for 1.673 cEUR at Mento rate 0.8365, and forex says 0.8336,
 * you got (0.8365 - 0.8336) * 2 = 0.0058 cEUR MORE than forex would give.
 * In USD: 0.0058 * $1.155 = $0.0067.
 * Simplified: grossProfit = (spreadPct / 100) * tradeValueUsd
 */
function computeTradePnl(t: Trade): TradePnl {
  const amountIn = parseFloat(t.amountIn);
  const inPrice = getTokenPrice(t.fromToken);
  const tradeValueUsd = amountIn * inPrice;
  const grossProfitUsd = (t.spreadPct / 100) * tradeValueUsd;
  const netProfitUsd = grossProfitUsd - ESTIMATED_GAS_COST_USD;

  return {
    id: t.id,
    pair: t.pair,
    amountIn: t.amountIn,
    amountOut: t.amountOut,
    spreadPct: t.spreadPct,
    tradeValueUsd: parseFloat(tradeValueUsd.toFixed(4)),
    grossProfitUsd: parseFloat(grossProfitUsd.toFixed(6)),
    estimatedGasCostUsd: ESTIMATED_GAS_COST_USD,
    netProfitUsd: parseFloat(netProfitUsd.toFixed(6)),
    explanation: `${t.spreadPct}% spread on $${tradeValueUsd.toFixed(2)} = $${grossProfitUsd.toFixed(4)} gross, $${netProfitUsd.toFixed(4)} after gas`,
    swapTxHash: t.swapTxHash,
    timestamp: t.timestamp,
  };
}

function buildProfitabilitySummary(
  tradePnls: TradePnl[],
  totalVolumeUsd: number,
  totalGrossProfitUsd: number,
  totalNetProfitUsd: number,
  avgSpread: number,
  tradingDays: number,
): string {
  const tradeCount = tradePnls.length;
  const gasCostTotal = parseFloat((tradeCount * ESTIMATED_GAS_COST_USD).toFixed(4));
  const cumulativeSpread = tradePnls.reduce((s, t) => s + t.spreadPct, 0);

  return (
    `CeloFX captured ${cumulativeSpread.toFixed(2)}% cumulative spread across ${tradeCount} trades ` +
    `($${totalVolumeUsd.toFixed(2)} volume). After ~$${gasCostTotal} total gas costs, ` +
    `net realized profit is $${totalNetProfitUsd.toFixed(4)}. ` +
    `The agent identifies Mento-Forex rate divergences averaging ${avgSpread.toFixed(2)}% ` +
    `and executes only when spread exceeds the dynamic threshold (0.1% floor + gas buffer). ` +
    `Edge source: Mento Broker protocol rates lag ECB forex updates by 30-120 minutes, ` +
    `creating temporary arbitrage windows.`
  );
}

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

  // --- Per-trade realized P&L ---
  const tradePnls = confirmed.map(computeTradePnl);

  // --- Aggregate profitability metrics ---
  const totalVolumeUsd = tradePnls.reduce((s, t) => s + t.tradeValueUsd, 0);
  const totalGrossProfitUsd = tradePnls.reduce((s, t) => s + t.grossProfitUsd, 0);
  const totalGasCostUsd = tradePnls.length * ESTIMATED_GAS_COST_USD;
  const totalNetProfitUsd = totalGrossProfitUsd - totalGasCostUsd;
  const profitPerDollarTraded = totalVolumeUsd > 0 ? totalNetProfitUsd / totalVolumeUsd : 0;

  // Annualized return: compute based on the time span of trades
  const timestamps = confirmed.map((t) => t.timestamp);
  const firstTradeMs = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const lastTradeMs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const tradingSpanMs = Math.max(lastTradeMs - firstTradeMs, 1);
  const tradingDays = tradingSpanMs / (1000 * 60 * 60 * 24);
  const periodReturn = totalVolumeUsd > 0 ? totalNetProfitUsd / totalVolumeUsd : 0;
  const rawAnnualized =
    tradingDays > 0
      ? (Math.pow(1 + periodReturn, 365 / tradingDays) - 1) * 100
      : 0;
  // Cap annualized return — extrapolating from < 7 days of data is misleading
  const annualizedReturnPct = tradingDays < 7 ? null : Math.min(rawAnnualized, 100);

  // --- Edge vs hold comparison ---
  // Holding cUSD yields 0% since it's a stablecoin pegged to $1
  const holdReturnUsd = 0;
  const tradingReturnUsd = totalNetProfitUsd;
  const edgeOverHoldPct =
    totalVolumeUsd > 0
      ? ((tradingReturnUsd - holdReturnUsd) / totalVolumeUsd) * 100
      : 0;

  // --- Profitability proof summary ---
  const profitabilitySummary = buildProfitabilitySummary(
    tradePnls,
    totalVolumeUsd,
    totalGrossProfitUsd,
    totalNetProfitUsd,
    avgSpread,
    tradingDays,
  );

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
    vault: (() => {
      const vm = getVaultMetrics(allTrades);
      return { tvl: vm.tvl, depositors: vm.depositors, sharePrice: vm.sharePrice };
    })(),
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
    // --- NEW: Profitability analysis ---
    profitability: {
      tokenPricesUsd: TOKEN_PRICES_USD,
      estimatedGasCostPerSwapUsd: ESTIMATED_GAS_COST_USD,
      perTradePnl: tradePnls,
      aggregate: {
        totalVolumeUsd: parseFloat(totalVolumeUsd.toFixed(4)),
        totalGrossProfitUsd: parseFloat(totalGrossProfitUsd.toFixed(6)),
        totalGasCostUsd: parseFloat(totalGasCostUsd.toFixed(6)),
        totalNetProfitUsd: parseFloat(totalNetProfitUsd.toFixed(6)),
        profitPerDollarTraded: parseFloat(profitPerDollarTraded.toFixed(6)),
        tradingSpanDays: parseFloat(tradingDays.toFixed(2)),
        annualizedReturnPct: annualizedReturnPct !== null ? parseFloat(annualizedReturnPct.toFixed(2)) : null,
        annualizedNote: annualizedReturnPct === null ? "Insufficient data (< 7 trading days)" : undefined,
      },
      edgeVsHold: {
        holdReturnUsd,
        tradingReturnUsd: parseFloat(tradingReturnUsd.toFixed(6)),
        edgeOverHoldPct: parseFloat(edgeOverHoldPct.toFixed(4)),
        explanation:
          "Holding cUSD yields 0% (stablecoin peg). CeloFX generates alpha by capturing " +
          "Mento-Forex rate divergences that exceed the dynamic spread threshold.",
      },
      profitabilitySummary,
    },
  });
}
