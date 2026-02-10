import { NextResponse } from "next/server";
import { fetchCommodityPrices } from "@/lib/market-data";

export async function GET() {
  try {
    const prices = await fetchCommodityPrices();
    return NextResponse.json(prices, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch commodity prices" },
      { status: 500 }
    );
  }
}
