import { NextRequest, NextResponse } from "next/server";
import { buildSwapTx, TOKENS, type MentoToken } from "@/lib/mento-sdk";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/types";
import { createPublicClient, createWalletClient, fallback, http, formatGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { getAttestation, getTeeHeaders } from "@/lib/tee";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { getDynamicSpreadThreshold } from "@/lib/agent-policy";
import { recoverMessageAddress, isAddress } from "viem";
import { consumeEoaNonce } from "@/lib/eoa-nonce";
import { deriveUserAgentWallet } from "@/lib/user-agent-wallet";
import { notifyOps } from "@/lib/notify";

export const maxDuration = 60;

const MAX_AMOUNT = 50; // Max notional per swap (USD equivalent)
const ALLOWED_TOKENS = new Set(["cUSD", "cEUR", "cREAL", "USDC", "USDT"]);
const MAX_RATE_DRIFT_BPS = 40; // 0.40% maximum deterioration allowed before send
const RESULT_TTL_MS = 15 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Gas thresholds: reject if gas cost eats >50% of expected profit
const MAX_GAS_PRICE_GWEI = BigInt(50); // Celo gas is usually <5 gwei, 50 = extreme
const SWAP_GAS_ESTIMATE = BigInt(250_000); // ~250K gas for approve + swap
const GAS_PROFIT_MAX_RATIO = 0.5; // Gas must be <50% of profit

const CELO_RPC_URLS = Array.from(
  new Set(
    [
      process.env.CELO_RPC_URL,
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo",
    ].filter(Boolean)
  )
) as string[];

const recentResults = new Map<string, { timestamp: number; payload: Record<string, unknown> }>();

function cleanupResults(now: number) {
  if (recentResults.size < 300) return;
  for (const [k, v] of recentResults) {
    if (now - v.timestamp > RESULT_TTL_MS) recentResults.delete(k);
  }
}

function rememberResult(key: string, payload: Record<string, unknown>) {
  cleanupResults(Date.now());
  recentResults.set(key, { timestamp: Date.now(), payload });
}

function getRememberedResult(key: string): Record<string, unknown> | null {
  const v = recentResults.get(key);
  if (!v) return null;
  if (Date.now() - v.timestamp > RESULT_TTL_MS) {
    recentResults.delete(key);
    return null;
  }
  return v.payload;
}

function createCeloPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: fallback(CELO_RPC_URLS.map((u) => http(u, { timeout: 10_000, retryCount: 1 })), { rank: false }),
  });
}

function createCeloWalletClient(account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({
    account,
    chain: celo,
    transport: fallback(CELO_RPC_URLS.map((u) => http(u, { timeout: 10_000, retryCount: 1 })), { rank: false }),
  });
}

function rateDriftBps(initialRate: number, freshRate: number): number {
  if (!Number.isFinite(initialRate) || initialRate <= 0) return 0;
  const driftPct = ((initialRate - freshRate) / initialRate) * 100;
  return Math.round(driftPct * 100);
}

export async function POST(request: NextRequest) {
  const authRequest = request.clone();

  const teeAttestation = await getAttestation();
  const body = await request.json();
  const { fromToken, toToken, amount } = body as {
    fromToken: MentoToken;
    toToken: MentoToken;
    amount: string;
    idempotencyKey?: string;
    requester?: string;
    signature?: string;
    timestamp?: number;
    nonce?: string;
  };
  const rawIdempotencyKey =
    request.headers.get("x-idempotency-key") ||
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  const idempotencyKey = rawIdempotencyKey
    ? `swap-exec:${rawIdempotencyKey.trim().slice(0, 128)}`
    : null;
  if (idempotencyKey) {
    const cached = getRememberedResult(idempotencyKey);
    if (cached) {
      return NextResponse.json({ ...cached, idempotent: true }, { headers: getTeeHeaders() });
    }
  }

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

  const hasAgentHeaders = Boolean(
    request.headers.get("x-agent-signature") || request.headers.get("authorization")
  );

  let requester: string | null = null;
  let authMode: "agent_api" | "eoa_signed" = "agent_api";
  let executionWalletAddress: `0x${string}` | null = null;
  let privateKey: `0x${string}` | undefined;

  if (hasAgentHeaders) {
    if (!hasAgentSecret()) return missingSecretResponse();
    const auth = await requireSignedAuth(authRequest);
    if (!auth.ok) return unauthorizedResponse();
    const raw = process.env.AGENT_PRIVATE_KEY;
    if (!raw) {
      return NextResponse.json({ error: "AGENT_PRIVATE_KEY not configured" }, { status: 503 });
    }
    privateKey = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  } else {
    const signature = body.signature;
    const timestamp = Number(body.timestamp);
    const nonce = body.nonce?.trim();
    const requesterRaw = body.requester?.trim().toLowerCase();
    if (
      !signature ||
      !nonce ||
      !requesterRaw ||
      !isAddress(requesterRaw) ||
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Provide wallet signature or agent API auth." },
        { status: 401 }
      );
    }
    if (!(await consumeEoaNonce({ scope: "swap-execute", signer: requesterRaw, nonce, timestamp }))) {
      return NextResponse.json(
        { error: "Expired or replayed signature nonce", retryable: false, nextStep: "Create a fresh signature and retry." },
        { status: 401 }
      );
    }

    const message = [
      "CeloFX Arbitrage Execute",
      `requester:${requesterRaw}`,
      `fromToken:${fromToken}`,
      `toToken:${toToken}`,
      `amount:${amount}`,
      `nonce:${nonce}`,
      `timestamp:${timestamp}`,
    ].join("\n");

    try {
      const recovered = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
      if (recovered.toLowerCase() !== requesterRaw) return unauthorizedResponse();
      const derived = deriveUserAgentWallet(requesterRaw);
      privateKey = derived.privateKey;
      executionWalletAddress = derived.address;
      requester = requesterRaw;
      authMode = "eoa_signed";
    } catch {
      return unauthorizedResponse();
    }
  }
  if (!privateKey) {
    return NextResponse.json({ error: "Execution wallet not configured" }, { status: 503 });
  }

  const tradeId = `trade-${Date.now()}`;

  try {
    // Profitability check: dynamic threshold based on gas + buffers + absolute PnL floor
    const { getOnChainQuote } = await import("@/lib/mento-sdk");
    const freshQuote = await getOnChainQuote(fromToken, toToken, "1");
    const dynamicThreshold = await getDynamicSpreadThreshold(numAmount);
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
      if (realSpread < dynamicThreshold.requiredSpreadPct) {
        return NextResponse.json({
          error: `Swap rejected: spread ${realSpread.toFixed(2)}% is below dynamic threshold +${dynamicThreshold.requiredSpreadPct}%. Mento: ${freshQuote.rate.toFixed(6)}, Forex: ${expectedForex.toFixed(6)}.`,
          spread: realSpread,
          thresholdDetails: dynamicThreshold,
        }, { status: 400 });
      }
    }

    // Gas price check: reject if gas is abnormally high
    const publicClientForGas = createCeloPublicClient();
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
    const account = privateKeyToAccount(privateKey);
    const wallet = createCeloWalletClient(account);
    const publicClient = createCeloPublicClient();

    // Fee abstraction: pay gas in cUSD instead of CELO (CIP-64)
    const feeCurrency = TOKENS.cUSD as `0x${string}`;

    // Revalidate immediately before sending txs; prevents stale-quote execution.
    const preSendQuote = await getOnChainQuote(fromToken, toToken, amount);
    const driftBps = rateDriftBps(swapResult.summary.rate, preSendQuote.rate);
    if (driftBps > MAX_RATE_DRIFT_BPS) {
      updateTrade(tradeId, {
        status: "failed",
        error: `Rate moved unfavorably by ${driftBps}bps before execution`,
      });
      return NextResponse.json(
        {
          error: `Rate moved by ${driftBps}bps before send; execution aborted.`,
          code: "RATE_MOVED",
          retryable: true,
          nextStep: "Re-quote and retry with fresh market data.",
          expectedRate: swapResult.summary.rate,
          preSendRate: preSendQuote.rate,
          maxAllowedDriftBps: MAX_RATE_DRIFT_BPS,
          tradeId,
        },
        { status: 409, headers: getTeeHeaders() }
      );
    }

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

    const responsePayload: Record<string, unknown> = {
      success: true,
      tradeId,
      authMode,
      requester,
      executionWallet: executionWalletAddress ?? account.address,
      approvalTxHash: approvalHash,
      swapTxHash: swapHash,
      rate: preSendQuote.rate,
      amountOut: swapResult.summary.expectedOut,
      celoscanUrl: `https://celoscan.io/tx/${swapHash}`,
      gasPriceGwei: formatGwei(gasPrice),
      gasCostUsd: +gasCostUsd.toFixed(6),
      teeAttestation,
    };
    if (idempotencyKey) {
      rememberResult(idempotencyKey, responsePayload);
    }
    void notifyOps("arbitrage_swap_executed", {
      tradeId,
      pair: `${fromToken}/${toToken}`,
      amountIn: amount,
      authMode,
      requester,
      executionWallet: executionWalletAddress ?? account.address,
      swapTxHash: swapHash,
    });
    return NextResponse.json(responsePayload, { headers: getTeeHeaders() });
  } catch (err) {
    updateTrade(tradeId, {
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    const message = err instanceof Error ? err.message : "Swap failed";
    const retryable = /timeout|network|rpc|gateway|temporarily/i.test(message);
    return NextResponse.json(
      {
        error: message,
        tradeId,
        teeAttestation,
        retryable,
        nextStep: retryable
          ? "Retry with a fresh quote in a few seconds."
          : "Check spread, gas, and wallet funding before retrying.",
      },
      { status: 500, headers: getTeeHeaders() }
    );
  }
}
