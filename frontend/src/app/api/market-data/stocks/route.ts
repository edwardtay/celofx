import { NextResponse } from "next/server";
import { fetchStockPrices } from "@/lib/market-data";

export async function GET() {
  try {
    const prices = await fetchStockPrices();
    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stock prices" },
      { status: 500 }
    );
  }
}
