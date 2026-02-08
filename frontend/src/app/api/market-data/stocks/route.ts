import { NextResponse } from "next/server";
import { fetchStockPrices } from "@/lib/market-data";

export async function GET() {
  const prices = await fetchStockPrices();
  return NextResponse.json(prices, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
