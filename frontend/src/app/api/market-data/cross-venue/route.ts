import { NextResponse } from "next/server";
import { getCrossVenueRates } from "@/lib/uniswap-quotes";

export const revalidate = 0;

export async function GET() {
  try {
    const rates = await getCrossVenueRates();
    return NextResponse.json({
      rates,
      timestamp: Date.now(),
      venues: ["mento", "uniswap-v3"],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch cross-venue rates" },
      { status: 500 }
    );
  }
}
