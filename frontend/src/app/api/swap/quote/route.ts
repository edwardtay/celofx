import { NextResponse } from "next/server";
import { getOnChainQuote, buildSwapTx, TOKENS, type MentoToken } from "@/lib/mento-sdk";
import { getUniswapQuote, UNI_TOKENS, type UniToken } from "@/lib/uniswap-quotes";
import { apiError } from "@/lib/api-errors";

const MAX_QUOTE_AMOUNT = 1000;

/** Reverse lookup: address (lowercased) → symbol for Mento tokens */
const MENTO_ADDR_TO_SYMBOL: Record<string, MentoToken> = Object.fromEntries(
  Object.entries(TOKENS).map(([sym, addr]) => [addr.toLowerCase(), sym as MentoToken])
);

/** Reverse lookup: address (lowercased) → symbol for Uniswap tokens */
const UNI_ADDR_TO_SYMBOL: Record<string, UniToken> = Object.fromEntries(
  Object.entries(UNI_TOKENS).map(([sym, info]) => [info.address.toLowerCase(), sym as UniToken])
);

/**
 * Resolve a query param (symbol like "cUSD" or address like "0x765DE8...")
 * to a token symbol. Returns null if unrecognized.
 */
function resolveToken(input: string): string | null {
  // Already a known symbol (Mento or Uniswap)
  if (input in TOKENS) return input;
  if (input in UNI_TOKENS) return input;
  // Try address lookup
  const lower = input.toLowerCase();
  return MENTO_ADDR_TO_SYMBOL[lower] ?? UNI_ADDR_TO_SYMBOL[lower] ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const amount = searchParams.get("amount") || "1";
  const venue = searchParams.get("venue") || "auto"; // "mento", "uniswap", "auto"

  if (!rawFrom || !rawTo) {
    return NextResponse.json(
      apiError("MISSING_FIELDS", "Missing from/to token query parameters"),
      { status: 400 }
    );
  }

  const from = resolveToken(rawFrom);
  const to = resolveToken(rawTo);

  if (!from || !to) {
    return NextResponse.json(
      apiError("INVALID_TOKEN", `Unrecognized token: ${!from ? rawFrom : rawTo}`, { from: rawFrom, to: rawTo }),
      { status: 400 }
    );
  }

  const isMentoFrom = from in TOKENS;
  const isMentoTo = to in TOKENS;
  const isUniFrom = from in UNI_TOKENS;
  const isUniTo = to in UNI_TOKENS;

  try {
    // Try Mento first (unless explicitly requesting Uniswap)
    if (venue !== "uniswap" && isMentoFrom && isMentoTo) {
      try {
        const quote = await getOnChainQuote(from as MentoToken, to as MentoToken, amount);
        return NextResponse.json({ ...quote, venue: "mento" });
      } catch {
        // Mento has no exchange for this pair — fall through to Uniswap
      }
    }

    // Try Uniswap V3 (fallback, or when explicitly requested)
    if (venue !== "mento" && isUniFrom && isUniTo) {
      try {
        const quote = await getUniswapQuote(from as UniToken, to as UniToken, amount);
        return NextResponse.json({ ...quote, venue: "uniswap-v3" });
      } catch {
        // Uniswap has no pool for this pair — fall through to error
      }
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

    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > MAX_QUOTE_AMOUNT) {
      return NextResponse.json(
        apiError("INVALID_AMOUNT", `Amount must be between 0 and ${MAX_QUOTE_AMOUNT}`, { amount }),
        { status: 400 }
      );
    }

    const slippageNum = slippage === undefined ? 1 : Number(slippage);
    if (Number.isNaN(slippageNum) || slippageNum <= 0 || slippageNum > 5) {
      return NextResponse.json(
        apiError("INVALID_SLIPPAGE", "Slippage must be between 0 and 5", { slippage }),
        { status: 400 }
      );
    }

    const txData = await buildSwapTx(
      fromToken as MentoToken,
      toToken as MentoToken,
      amount,
      slippageNum
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
