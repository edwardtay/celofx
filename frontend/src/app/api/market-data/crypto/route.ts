import { NextResponse } from "next/server";
import { fetchCryptoPrices } from "@/lib/market-data";

export async function GET() {
  try {
    const prices = await fetchCryptoPrices();
    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch crypto prices" },
      { status: 500 }
    );
  }
}
