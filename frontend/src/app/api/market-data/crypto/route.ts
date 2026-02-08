import { NextResponse } from "next/server";
import { fetchCryptoPrices } from "@/lib/market-data";

export async function GET() {
  const prices = await fetchCryptoPrices();
  return NextResponse.json(prices, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
