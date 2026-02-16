import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, fallback, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { consumeEoaNonce } from "@/lib/eoa-nonce";
import { deriveUserAgentWallet } from "@/lib/user-agent-wallet";
import { recoverMessageAddress, isAddress } from "viem";
import { buildSwapTx, getOnChainQuote, TOKENS, type MentoToken } from "@/lib/mento-sdk";
import { buildUniswapSwapTx, getUniswapQuote, type UniToken } from "@/lib/uniswap-quotes";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/types";
import { notifyOps } from "@/lib/notify";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const RESULT_TTL_MS = 15 * 60 * 1000;
const MIN_VENUE_SPREAD_PCT = 0.3;
const MIN_EXPECTED_PNL_PCT = 0.05;
const MAX_ARB_AMOUNT = 50;

const CELO_RPC_URLS = Array.from(
  new Set(
    [process.env.CELO_RPC_URL, "https://forno.celo.org", "https://rpc.ankr.com/celo"].filter(Boolean)
  )
) as string[];

const recentResults = new Map<string, { timestamp: number; payload: Record<string, unknown> }>();

type Venue = "mento" | "uniswap";
type ExecuteBody = {
  pair: string;
  amount: string;
  buyVenue?: Venue;
  sellVenue?: Venue;
  idempotencyKey?: string;
  requester?: string;
  signature?: string;
  timestamp?: number;
  nonce?: string;
};

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

async function quoteVenue(venue: Venue, fromToken: string, toToken: string, amount: string) {
  if (venue === "mento") {
    const q = await getOnChainQuote(fromToken as MentoToken, toToken as MentoToken, amount);
    return { rate: q.rate, amountOut: q.amountOut };
  }
  const q = await getUniswapQuote(fromToken as UniToken, toToken as UniToken, amount);
  return { rate: q.rate, amountOut: q.amountOut };
}

async function executeLeg(params: {
  venue: Venue;
  fromToken: string;
  toToken: string;
  amount: string;
  walletAddress: `0x${string}`;
  wallet: ReturnType<typeof createCeloWalletClient>;
  publicClient: ReturnType<typeof createCeloPublicClient>;
}) {
  const feeCurrency = TOKENS.cUSD as `0x${string}`;
  if (params.venue === "mento") {
    const tx = await buildSwapTx(params.fromToken as MentoToken, params.toToken as MentoToken, params.amount);
    const approvalHash = await params.wallet.sendTransaction({
      to: TOKENS[params.fromToken as MentoToken],
      data: tx.approvalTx.data as `0x${string}`,
      feeCurrency,
    });
    await params.publicClient.waitForTransactionReceipt({ hash: approvalHash });
    const swapHash = await params.wallet.sendTransaction({
      to: tx.swapTx.to,
      data: tx.swapTx.data as `0x${string}`,
      feeCurrency,
    });
    await params.publicClient.waitForTransactionReceipt({ hash: swapHash });
    return { approvalHash, swapHash, expectedOut: tx.summary.expectedOut };
  }

  const tx = await buildUniswapSwapTx(
    params.fromToken as UniToken,
    params.toToken as UniToken,
    params.amount,
    params.walletAddress
  );
  const approvalHash = await params.wallet.sendTransaction({
    to: tx.approvalTx.to,
    data: tx.approvalTx.data as `0x${string}`,
    feeCurrency,
  });
  await params.publicClient.waitForTransactionReceipt({ hash: approvalHash });
  const swapHash = await params.wallet.sendTransaction({
    to: tx.swapTx.to,
    data: tx.swapTx.data as `0x${string}`,
    feeCurrency,
  });
  await params.publicClient.waitForTransactionReceipt({ hash: swapHash });
  return { approvalHash, swapHash, expectedOut: tx.summary.expectedOut };
}

export async function POST(request: NextRequest) {
  const authRequest = request.clone();
  const body = (await request.json()) as ExecuteBody;
  const { pair, amount } = body;

  if (!pair || !amount) {
    return NextResponse.json({ error: "Missing pair or amount" }, { status: 400 });
  }
  const [tokenA, tokenB] = pair.split("/");
  if (!tokenA || !tokenB || tokenA === tokenB) {
    return NextResponse.json({ error: "Invalid pair" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > MAX_ARB_AMOUNT) {
    return NextResponse.json({ error: `Amount must be between 0 and ${MAX_ARB_AMOUNT}` }, { status: 400 });
  }

  const rawIdempotencyKey =
    request.headers.get("x-idempotency-key") ||
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  const idempotencyKey = rawIdempotencyKey ? `arb-exec:${rawIdempotencyKey.trim().slice(0, 128)}` : null;
  if (idempotencyKey) {
    const cached = getRememberedResult(idempotencyKey);
    if (cached) return NextResponse.json({ ...cached, idempotent: true });
  }

  const hasAgentHeaders = Boolean(request.headers.get("x-agent-signature") || request.headers.get("authorization"));
  let requester: string | null = null;
  let authMode: "agent_api" | "eoa_signed" = "agent_api";
  let executionWalletAddress: `0x${string}` | null = null;
  let privateKey: `0x${string}` | undefined;

  if (hasAgentHeaders) {
    if (!hasAgentSecret()) return missingSecretResponse();
    const auth = await requireSignedAuth(authRequest);
    if (!auth.ok) return unauthorizedResponse();
    const raw = process.env.AGENT_PRIVATE_KEY;
    if (!raw) return NextResponse.json({ error: "AGENT_PRIVATE_KEY not configured" }, { status: 503 });
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
    if (!(await consumeEoaNonce({ scope: "arb-execute", signer: requesterRaw, nonce, timestamp }))) {
      return NextResponse.json(
        { error: "Expired or replayed signature nonce", retryable: false, nextStep: "Create a fresh signature and retry." },
        { status: 401 }
      );
    }
    const message = [
      "CeloFX Cross-DEX Execute",
      `requester:${requesterRaw}`,
      `pair:${pair}`,
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

  const tradeId = `arb-${Date.now()}`;
  try {
    const [mentoQuote, uniQuote] = await Promise.all([
      quoteVenue("mento", tokenA, tokenB, amount),
      quoteVenue("uniswap", tokenA, tokenB, amount),
    ]);
    const venueSpreadPct = ((mentoQuote.rate - uniQuote.rate) / uniQuote.rate) * 100;
    if (Math.abs(venueSpreadPct) < MIN_VENUE_SPREAD_PCT) {
      return NextResponse.json(
        {
          error: `Venue spread ${venueSpreadPct.toFixed(2)}% is below ${MIN_VENUE_SPREAD_PCT}% threshold.`,
          venueSpreadPct,
        },
        { status: 400 }
      );
    }

    const buyVenue: Venue = body.buyVenue ?? (mentoQuote.rate >= uniQuote.rate ? "mento" : "uniswap");
    const sellVenue: Venue = body.sellVenue ?? (buyVenue === "mento" ? "uniswap" : "mento");
    if (buyVenue === sellVenue) {
      return NextResponse.json({ error: "buyVenue and sellVenue must differ" }, { status: 400 });
    }

    const buyQuote = buyVenue === "mento" ? mentoQuote : uniQuote;
    const sellQuote = await quoteVenue(sellVenue, tokenB, tokenA, buyQuote.amountOut);
    const finalOut = Number(sellQuote.amountOut);
    const pnl = finalOut - amountNum;
    const pnlPct = (pnl / amountNum) * 100;
    if (pnlPct < MIN_EXPECTED_PNL_PCT) {
      return NextResponse.json(
        {
          error: `Expected roundtrip PnL ${pnlPct.toFixed(3)}% is below ${MIN_EXPECTED_PNL_PCT}% threshold.`,
          expectedPnlPct: pnlPct,
        },
        { status: 400 }
      );
    }

    const account = privateKeyToAccount(privateKey);
    const wallet = createCeloWalletClient(account);
    const publicClient = createCeloPublicClient();
    const walletAddress = executionWalletAddress ?? account.address;

    const pendingTrade: Trade = {
      id: tradeId,
      pair: `${tokenA}/${tokenB}`,
      fromToken: tokenA,
      toToken: tokenB,
      amountIn: amount,
      amountOut: sellQuote.amountOut,
      rate: buyQuote.rate,
      spreadPct: venueSpreadPct,
      status: "pending",
      timestamp: Date.now(),
    };
    addTrade(pendingTrade);

    const buy = await executeLeg({
      venue: buyVenue,
      fromToken: tokenA,
      toToken: tokenB,
      amount,
      walletAddress,
      wallet,
      publicClient,
    });
    const sell = await executeLeg({
      venue: sellVenue,
      fromToken: tokenB,
      toToken: tokenA,
      amount: buy.expectedOut,
      walletAddress,
      wallet,
      publicClient,
    });

    updateTrade(tradeId, {
      status: "confirmed",
      approvalTxHash: buy.approvalHash,
      swapTxHash: sell.swapHash,
      amountOut: sell.expectedOut,
      pnl,
    });

    const responsePayload: Record<string, unknown> = {
      success: true,
      tradeId,
      authMode,
      requester,
      executionWallet: walletAddress,
      pair,
      amountIn: amount,
      buyVenue,
      sellVenue,
      venueSpreadPct: Number(venueSpreadPct.toFixed(4)),
      expectedPnlPct: Number(pnlPct.toFixed(4)),
      buyApprovalTxHash: buy.approvalHash,
      buySwapTxHash: buy.swapHash,
      sellApprovalTxHash: sell.approvalHash,
      sellSwapTxHash: sell.swapHash,
      amountOut: sell.expectedOut,
    };
    if (idempotencyKey) rememberResult(idempotencyKey, responsePayload);

    void notifyOps("cross_dex_arb_executed", {
      tradeId,
      pair,
      amountIn: amount,
      buyVenue,
      sellVenue,
      expectedPnlPct: Number(pnlPct.toFixed(4)),
      sellSwapTxHash: sell.swapHash,
    });

    return NextResponse.json(responsePayload);
  } catch (err) {
    updateTrade(tradeId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Cross-DEX arbitrage failed",
    });
    const message = err instanceof Error ? err.message : "Cross-DEX arbitrage failed";
    const retryable = /timeout|network|rpc|gateway|temporarily/i.test(message);
    return NextResponse.json(
      {
        error: message,
        retryable,
        nextStep: retryable
          ? "Retry in a few seconds with fresh quotes."
          : "Check execution wallet balance, supported pair, and market spread before retrying.",
      },
      { status: 500 }
    );
  }
}
