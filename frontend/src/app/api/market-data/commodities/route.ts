import { NextResponse } from "next/server";
import { fetchCommodityPrices } from "@/lib/market-data";

export async function GET() {
  const prices = fetchCommodityPrices();
  return NextResponse.json(prices, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
