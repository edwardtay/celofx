import { NextResponse } from "next/server";
import { getOnChainQuote, buildSwapTx, type MentoToken, TOKENS } from "@/lib/mento-sdk";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") as MentoToken | null;
  const to = searchParams.get("to") as MentoToken | null;
  const amount = searchParams.get("amount") || "1";

  if (!from || !to || !(from in TOKENS) || !(to in TOKENS)) {
    return NextResponse.json(
      { error: "Invalid tokens. Use cUSD, cEUR, cREAL, or CELO" },
      { status: 400 }
    );
  }

  try {
    const quote = await getOnChainQuote(from, to, amount);
    return NextResponse.json(quote);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote failed" },
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
        { error: "Missing fromToken, toToken, or amount" },
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
      { error: err instanceof Error ? err.message : "Swap build failed" },
      { status: 500 }
    );
  }
}
