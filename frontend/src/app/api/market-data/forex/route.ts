import { NextResponse } from "next/server";
import { fetchForexRates } from "@/lib/market-data";

export async function GET() {
  try {
    const rates = await fetchForexRates();
    return NextResponse.json(rates, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch forex rates" },
      { status: 500 }
    );
  }
}
