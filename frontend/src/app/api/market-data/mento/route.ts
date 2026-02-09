import { NextResponse } from "next/server";
import { getMentoOnChainRates } from "@/lib/mento-sdk";
import { fetchMentoRates } from "@/lib/market-data";

export async function GET() {
  try {
    // Try real on-chain Mento Broker rates first
    const rates = await getMentoOnChainRates();
    if (rates.length > 0) {
      return NextResponse.json(rates, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }
    // Fallback to CoinGecko-based rates
    const fallback = await fetchMentoRates();
    return NextResponse.json(fallback, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    try {
      const fallback = await fetchMentoRates();
      return NextResponse.json(fallback, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch Mento rates" },
        { status: 500 }
      );
    }
  }
}
