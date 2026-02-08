import { NextResponse } from "next/server";
import { fetchForexRates } from "@/lib/market-data";

export async function GET() {
  const rates = await fetchForexRates();
  return NextResponse.json(rates, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
