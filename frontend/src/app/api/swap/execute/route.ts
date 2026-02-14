import { NextRequest, NextResponse } from "next/server";
import { buildSwapTx, TOKENS, type MentoToken, MIN_PROFITABLE_SPREAD_PCT } from "@/lib/mento-sdk";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/types";
import { createPublicClient, createWalletClient, http, formatGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { getAttestation, getTeeHeaders } from "@/lib/tee";

export const maxDuration = 60;

const MAX_AMOUNT = 50; // Max notional per swap (USD equivalent)
const ALLOWED_TOKENS = new Set(["cUSD", "cEUR", "cREAL", "USDC", "USDT"]);

// Gas thresholds: reject if gas cost eats >50% of expected profit
const MAX_GAS_PRICE_GWEI = BigInt(50); // Celo gas is usually <5 gwei, 50 = extreme
const SWAP_GAS_ESTIMATE = BigInt(250_000); // ~250K gas for approve + swap
const GAS_PROFIT_MAX_RATIO = 0.5; // Gas must be <50% of profit

function verifyAuth(request: NextRequest): boolean {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teeAttestation = await getAttestation();
  const body = await request.json();
  const { fromToken, toToken, amount } = body as {
    fromToken: MentoToken;
    toToken: MentoToken;
    amount: string;
  };

  if (!fromToken || !toToken || !amount) {
    return NextResponse.json({ error: "Missing fromToken, toToken, or amount" }, { status: 400 });
  }

  if (!ALLOWED_TOKENS.has(fromToken) || !ALLOWED_TOKENS.has(toToken)) {
    return NextResponse.json({ error: "Invalid token pair" }, { status: 400 });
  }

  if (fromToken === toToken) {
    return NextResponse.json({ error: "fromToken and toToken must differ" }, { status: 400 });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT) {
    return NextResponse.json({ error: `Amount must be between 0 and ${MAX_AMOUNT}` }, { status: 400 });
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: "AGENT_PRIVATE_KEY not configured" }, { status: 503 });
  }

  const tradeId = `trade-${Date.now()}`;

  try {
    // Profitability check: verify spread is positive before executing
    const { getOnChainQuote } = await import("@/lib/mento-sdk");
    const freshQuote = await getOnChainQuote(fromToken, toToken, "1");
    const forexRes = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL", { signal: AbortSignal.timeout(5000) })
      .then(r => r.json())
      .catch(() => ({ rates: { EUR: 0.926, BRL: 5.7 } }));

    const forexMap: Record<string, number> = {
      "cUSD/cEUR": forexRes.rates?.EUR ?? 0.926,
      "cUSD/cREAL": forexRes.rates?.BRL ?? 5.7,
      "cEUR/cUSD": 1 / (forexRes.rates?.EUR ?? 0.926),
      "cREAL/cUSD": 1 / (forexRes.rates?.BRL ?? 5.7),
    };
    const pairKey = `${fromToken}/${toToken}`;
    const expectedForex = forexMap[pairKey];
    let realSpread = 0;
    if (expectedForex) {
      realSpread = ((freshQuote.rate - expectedForex) / expectedForex) * 100;
      if (realSpread < MIN_PROFITABLE_SPREAD_PCT) {
        return NextResponse.json({
          error: `Swap rejected: spread ${realSpread.toFixed(2)}% is not profitable (need > +${MIN_PROFITABLE_SPREAD_PCT}%). Mento: ${freshQuote.rate.toFixed(6)}, Forex: ${expectedForex.toFixed(6)}. Vault capital protected.`,
          spread: realSpread,
        }, { status: 400 });
      }
    }

    // Gas price check: reject if gas is abnormally high
    const publicClientForGas = createPublicClient({
      chain: celo,
      transport: http("https://forno.celo.org"),
    });
    const gasPrice = await publicClientForGas.getGasPrice();
    const gasPriceGwei = gasPrice / BigInt(1_000_000_000);

    if (gasPriceGwei > MAX_GAS_PRICE_GWEI) {
      return NextResponse.json({
        error: `Gas price too high: ${formatGwei(gasPrice)} gwei (max ${MAX_GAS_PRICE_GWEI} gwei). Waiting for lower gas.`,
        gasPrice: formatGwei(gasPrice),
      }, { status: 400 });
    }

    // Estimate gas cost in USD (CELO ~$0.50, gas in gwei)
    const gasCostWei = gasPrice * SWAP_GAS_ESTIMATE;
    const gasCostCelo = Number(gasCostWei) / 1e18;
    const gasCostUsd = gasCostCelo * 0.5; // rough CELO price estimate
    const expectedProfitUsd = numAmount * (realSpread / 100);

    if (expectedProfitUsd > 0 && gasCostUsd / expectedProfitUsd > GAS_PROFIT_MAX_RATIO) {
      return NextResponse.json({
        error: `Gas cost ($${gasCostUsd.toFixed(4)}) exceeds ${GAS_PROFIT_MAX_RATIO * 100}% of expected profit ($${expectedProfitUsd.toFixed(4)}). Skipping to protect capital.`,
        gasPrice: formatGwei(gasPrice),
        gasCostUsd,
        expectedProfitUsd,
      }, { status: 400 });
    }

    // Build swap tx
    const swapResult = await buildSwapTx(fromToken, toToken, amount);

    // Record as pending
    const trade: Trade = {
      id: tradeId,
      pair: `${fromToken}/${toToken}`,
      fromToken,
      toToken,
      amountIn: amount,
      amountOut: swapResult.summary.expectedOut,
      rate: swapResult.summary.rate,
      spreadPct: 0,
      status: "pending",
      timestamp: Date.now(),
    };
    addTrade(trade);

    // Execute on-chain
    const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(normalizedKey);
    const wallet = createWalletClient({
      account,
      chain: celo,
      transport: http("https://forno.celo.org"),
    });
    const publicClient = createPublicClient({
      chain: celo,
      transport: http("https://forno.celo.org"),
    });

    // Fee abstraction: pay gas in cUSD instead of CELO (CIP-64)
    const feeCurrency = TOKENS.cUSD as `0x${string}`;

    // Approval tx
    const approvalHash = await wallet.sendTransaction({
      to: TOKENS[fromToken],
      data: swapResult.approvalTx.data as `0x${string}`,
      feeCurrency,
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalHash });

    // Swap tx
    const swapHash = await wallet.sendTransaction({
      to: swapResult.swapTx.to,
      data: swapResult.swapTx.data as `0x${string}`,
      feeCurrency,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

    updateTrade(tradeId, {
      status: receipt.status === "success" ? "confirmed" : "failed",
      approvalTxHash: approvalHash,
      swapTxHash: swapHash,
    });

    return NextResponse.json(
      {
        success: true,
        tradeId,
        approvalTxHash: approvalHash,
        swapTxHash: swapHash,
        rate: swapResult.summary.rate,
        amountOut: swapResult.summary.expectedOut,
        celoscanUrl: `https://celoscan.io/tx/${swapHash}`,
        gasPriceGwei: formatGwei(gasPrice),
        gasCostUsd: +gasCostUsd.toFixed(6),
        teeAttestation,
      },
      { headers: getTeeHeaders() }
    );
  } catch (err) {
    updateTrade(tradeId, {
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Swap failed", tradeId, teeAttestation },
      { status: 500, headers: getTeeHeaders() }
    );
  }
}
