import { NextResponse } from "next/server";
import { getOnChainQuote, buildSwapTx, type MentoToken, TOKENS } from "@/lib/mento-sdk";
import { getUniswapQuote, UNI_TOKENS, type UniToken } from "@/lib/uniswap-quotes";
import { apiError } from "@/lib/api-errors";

const MENTO_TOKENS = new Set(["cUSD", "cEUR", "cREAL", "CELO"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const amount = searchParams.get("amount") || "1";
  const venue = searchParams.get("venue") || "auto"; // "mento", "uniswap", "auto"

  if (!from || !to) {
    return NextResponse.json(
      apiError("MISSING_FIELDS", "Missing from/to token query parameters"),
      { status: 400 }
    );
  }

  try {
    // Try Mento first for Mento-native pairs
    if (venue !== "uniswap" && MENTO_TOKENS.has(from) && MENTO_TOKENS.has(to)) {
      const quote = await getOnChainQuote(from as MentoToken, to as MentoToken, amount);
      return NextResponse.json({ ...quote, venue: "mento" });
    }

    // Try Uniswap for pairs with USDC/USDT or when explicitly requested
    if (from in UNI_TOKENS && to in UNI_TOKENS) {
      const quote = await getUniswapQuote(from as UniToken, to as UniToken, amount);
      return NextResponse.json({ ...quote, venue: "uniswap-v3" });
    }

    return NextResponse.json(
      apiError("NO_POOL_FOUND", `No venue found for ${from}/${to}`, { from, to }),
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      apiError("QUOTE_FAILED", err instanceof Error ? err.message : "Quote failed", { from, to, amount }),
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromToken, toToken, amount, slippage } = body;

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Missing fromToken, toToken, or amount"),
        { status: 400 }
      );
    }

    const txData = await buildSwapTx(
      fromToken as MentoToken,
      toToken as MentoToken,
      amount,
      slippage || 1
    );

    return NextResponse.json({
      ...txData,
      broker: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD",
      chain: "celo",
      chainId: 42220,
    });
  } catch (err) {
    return NextResponse.json(
      apiError("SWAP_FAILED", err instanceof Error ? err.message : "Swap build failed", { fromToken: "unknown", toToken: "unknown" }),
      { status: 500 }
    );
  }
}
