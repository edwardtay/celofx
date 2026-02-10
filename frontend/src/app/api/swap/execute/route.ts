import { NextRequest, NextResponse } from "next/server";
import { buildSwapTx, TOKENS, type MentoToken } from "@/lib/mento-sdk";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Trade } from "@/lib/types";
import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fromToken, toToken, amount } = body as {
    fromToken: MentoToken;
    toToken: MentoToken;
    amount: string;
  };

  if (!fromToken || !toToken || !amount) {
    return NextResponse.json({ error: "Missing fromToken, toToken, or amount" }, { status: 400 });
  }

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json({ error: "AGENT_PRIVATE_KEY not configured" }, { status: 503 });
  }

  const tradeId = `trade-${Date.now()}`;

  try {
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

    return NextResponse.json({
      success: true,
      tradeId,
      approvalTxHash: approvalHash,
      swapTxHash: swapHash,
      rate: swapResult.summary.rate,
      amountOut: swapResult.summary.expectedOut,
      celoscanUrl: `https://celoscan.io/tx/${swapHash}`,
    });
  } catch (err) {
    updateTrade(tradeId, {
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Swap failed", tradeId },
      { status: 500 }
    );
  }
}
