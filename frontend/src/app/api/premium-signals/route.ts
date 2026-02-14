import { NextRequest, NextResponse } from "next/server";
import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { getPremiumSignals } from "@/lib/signal-store";
import type { MarketType } from "@/lib/types";
import { getTeeHeaders } from "@/lib/tee";
import { getMentoOnChainRates } from "@/lib/mento-sdk";
import { fetchCeloDefiYields } from "@/lib/market-data";
import { getDecisionLog, AGENT_POLICY } from "@/lib/agent-policy";

const payTo = (process.env.AGENT_OWNER_ADDRESS?.trim() ||
  "0x6652AcDc623b7CCd52E115161d84b949bAf3a303") as `0x${string}`;

// Celo Mainnet
const celo = defineChain(42220);

// Thirdweb client for x402 facilitator
const thirdwebSecretKey = process.env.THIRDWEB_SECRET_KEY;

function getThirdwebFacilitator() {
  if (!thirdwebSecretKey) return null;
  const client = createThirdwebClient({ secretKey: thirdwebSecretKey });
  return facilitator({ client, serverWalletAddress: payTo });
}

export async function GET(request: NextRequest) {
  const paymentData = request.headers.get("x-payment");
  const thirdwebFacilitator = getThirdwebFacilitator();

  // Use thirdweb settlePayment if configured
  if (thirdwebFacilitator) {
    const result = await settlePayment({
      resourceUrl: `${request.nextUrl.origin}/api/premium-signals`,
      method: "GET",
      paymentData,
      payTo,
      network: celo,
      price: "$0.10",
      facilitator: thirdwebFacilitator,
      routeConfig: {
        description:
          "Access premium FX trading signals with entry/exit prices and detailed reasoning",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    });

    if (result.status === 200) {
      const market = request.nextUrl.searchParams.get(
        "market"
      ) as MarketType | null;
      const alphaReport = await buildAlphaReport(market ?? undefined);
      return NextResponse.json(alphaReport, {
        headers: { ...result.responseHeaders, ...getTeeHeaders() },
      });
    }

    return new NextResponse(JSON.stringify(result.responseBody), {
      status: result.status,
      headers: { ...result.responseHeaders, ...getTeeHeaders() },
    });
  }

  // x402 payment verification requires thirdweb — no insecure fallback
  return NextResponse.json(
    {
      error: "Payment verification unavailable",
      message: "x402 payment requires THIRDWEB_SECRET_KEY to be configured for settlement verification",
    },
    { status: 503, headers: getTeeHeaders() }
  );
}

// Build the unique alpha report that combines data no single source provides
async function buildAlphaReport(market?: MarketType) {
  const [signals, rates, yields, decisions] = await Promise.all([
    Promise.resolve(getPremiumSignals(market)),
    getMentoOnChainRates().catch(() => []),
    fetchCeloDefiYields().catch(() => []),
    Promise.resolve(getDecisionLog()),
  ]);

  // Cross-venue rates (best effort)
  let crossVenue: unknown[] = [];
  try {
    const { getCrossVenueRates } = await import("@/lib/uniswap-quotes");
    crossVenue = await getCrossVenueRates();
  } catch { /* skip */ }

  // Find actionable spreads
  const actionableSpreads = rates
    .filter((r) => Math.abs(r.spreadPct) > 0.3)
    .map((r) => ({
      pair: r.pair,
      mentoRate: r.mentoRate,
      forexRate: r.forexRate,
      spreadPct: r.spreadPct,
      direction: r.direction,
      profitOn100cUSD: +(Math.abs(r.spreadPct) * 1).toFixed(4),
    }));

  // Best yield opportunity
  const sortedYields = [...yields].sort((a, b) => b.apy - a.apy);
  const bestYield = sortedYields[0] ?? null;

  return {
    type: "celofx_alpha_report",
    generatedAt: new Date().toISOString(),
    price: "$0.10 cUSD via x402",
    exclusiveData: {
      description: "Combined live on-chain + off-chain data unavailable from any single source",
      sources: [
        "Mento Broker on-chain rates (real-time contract reads)",
        "Uniswap V3 Quoter on Celo (real-time quotes)",
        "Frankfurter forex API (ECB rates)",
        "DeFiLlama yields API (Celo pools)",
        "CeloFX agent decision engine (Claude AI)",
      ],
    },
    signals,
    liveArbitrage: {
      mentoVsForex: rates.map((r) => ({
        pair: r.pair,
        mentoRate: r.mentoRate,
        forexRate: r.forexRate,
        spreadPct: r.spreadPct,
        direction: r.direction,
        actionable: Math.abs(r.spreadPct) > 0.3,
      })),
      actionableSpreads,
      crossVenueRates: crossVenue,
    },
    yieldOpportunities: {
      topYields: sortedYields.slice(0, 5).map((y) => ({
        pool: y.pool,
        protocol: y.protocol,
        apy: y.apy,
        apyMean30d: y.apyMean30d,
        tvl: y.tvl,
      })),
      bestYield: bestYield ? {
        pool: bestYield.pool,
        protocol: bestYield.protocol,
        apy: bestYield.apy,
        recommendation: bestYield.apy > 5
          ? "Above-average yield — consider allocating idle stablecoin reserves"
          : "Moderate yield — monitor for better entry",
      } : null,
    },
    agentDecisions: {
      recentCount: decisions.length,
      latest: decisions.slice(-5).map((d) => ({
        orderId: d.orderId,
        action: d.action,
        hash: d.hash,
        reasoning: d.reasoning,
        timestamp: new Date(d.timestamp).toISOString(),
      })),
    },
    agentPolicy: {
      maxSwapPerTx: AGENT_POLICY.permissions.maxSwapPerTx,
      maxDailyVolume: AGENT_POLICY.permissions.maxDailyVolume,
      minProfitableSpread: AGENT_POLICY.permissions.minProfitableSpread,
      allowedTokens: AGENT_POLICY.permissions.allowedTokens.map((t) => t.symbol),
    },
  };
}
