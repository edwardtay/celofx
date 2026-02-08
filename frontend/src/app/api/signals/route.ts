import { NextRequest, NextResponse } from "next/server";
import { getFreeSignals } from "@/lib/signal-store";
import type { MarketType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") as MarketType | null;
  const signals = getFreeSignals(market ?? undefined);
  return NextResponse.json(signals);
}
